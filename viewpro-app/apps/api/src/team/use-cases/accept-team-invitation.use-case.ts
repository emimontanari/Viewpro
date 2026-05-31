import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import type { MembershipsRepository } from '../../memberships/memberships.repository'
import { MEMBERSHIPS_REPOSITORY } from '../../memberships/memberships.repository'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import { mapAuthUser } from '../../auth/responses/auth-user.response'
import { mapMembership, type MeResponse } from '../../auth/responses/me.response'
import type { PasswordHasher } from '../../auth/security/password-hasher'
import { PASSWORD_HASHER } from '../../auth/security/password-hasher'
import type { RefreshTokenRepository } from '../../auth/tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../../auth/tokens/refresh-token.repository'
import { TokenService } from '../../auth/tokens/token.service'
import type { CurrentUser } from '../../auth/types/current-user'
import type { AuthSessionResult } from '../../auth/use-cases/register-tenant.use-case'
import { normalizeEmail } from '../../auth/utils/slugify'
import type { AcceptTeamInvitationDto } from '../dto/accept-team-invitation.dto'
import { hashTeamInvitationToken } from '../team-invitation-token'
import {
  TEAM_INVITATIONS_REPOSITORY,
  type AcceptTeamInvitationResult,
  type TeamInvitationsRepository,
  type ValidateTeamInvitationResult,
} from '../team-invitations.repository'

@Injectable()
export class AcceptTeamInvitationUseCase {
  constructor(
    @Inject(TEAM_INVITATIONS_REPOSITORY)
    private readonly teamInvitationsRepository: TeamInvitationsRepository,
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(MEMBERSHIPS_REPOSITORY) private readonly membershipsRepository: MembershipsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(TokenService) private readonly tokenService: TokenService,
  ) {}

  async execute(
    rawToken: string,
    dto: AcceptTeamInvitationDto,
    currentUser?: CurrentUser | null,
  ): Promise<AuthSessionResult> {
    const tokenHash = hashTeamInvitationToken(rawToken)
    const result = await this.acceptInvitation(tokenHash, dto, currentUser)

    if (result.status !== 'accepted') {
      this.throwForAcceptResult(result)
    }

    return this.createSession(result.user.id, result.user.email)
  }

  private async acceptInvitation(
    tokenHash: string,
    dto: AcceptTeamInvitationDto,
    currentUser?: CurrentUser | null,
  ): Promise<AcceptTeamInvitationResult> {
    if (dto.mode === 'register') {
      const firstName = dto.firstName?.trim() ?? ''
      const lastName = dto.lastName?.trim() || undefined

      if (!firstName) {
        throw new BadRequestException('Team member first name is required')
      }

      if (!dto.password) {
        throw new BadRequestException('Password is required')
      }

      if (currentUser) {
        const invitation = await this.validateInvitationForCredentialFlow(tokenHash)
        if (normalizeEmail(currentUser.email) !== normalizeEmail(invitation.invitation.email)) {
          throw new ForbiddenException('Team invitation belongs to another email')
        }
      }

      const passwordHash = await this.passwordHasher.hash(dto.password)
      return this.teamInvitationsRepository.acceptForNewUser({
        tokenHash,
        firstName,
        lastName,
        passwordHash,
        now: new Date(),
      })
    }

    const invitation = await this.validateInvitationForCredentialFlow(tokenHash)

    if (dto.mode === 'login') {
      if (!dto.password) {
        throw new BadRequestException('Password is required')
      }

      if (currentUser && normalizeEmail(currentUser.email) !== normalizeEmail(invitation.invitation.email)) {
        throw new ForbiddenException('Team invitation belongs to another email')
      }

      const user = await this.usersRepository.findByEmail(invitation.invitation.email)
      const validPassword = user ? await this.passwordHasher.verify(user.passwordHash, dto.password) : false

      if (!user || !validPassword) {
        throw new UnauthorizedException('Invalid email or password')
      }

      return this.teamInvitationsRepository.acceptForExistingUser({
        tokenHash,
        userId: user.id,
        now: new Date(),
      })
    }

    if (dto.mode === 'current-session') {
      if (!currentUser) {
        throw new UnauthorizedException('Authentication required')
      }

      if (normalizeEmail(currentUser.email) !== normalizeEmail(invitation.invitation.email)) {
        throw new ForbiddenException('Team invitation belongs to another email')
      }

      return this.teamInvitationsRepository.acceptForExistingUser({
        tokenHash,
        userId: currentUser.id,
        now: new Date(),
      })
    }

    throw new BadRequestException('Unsupported team invitation acceptance mode')
  }

  private async validateInvitationForCredentialFlow(tokenHash: string) {
    const result = await this.teamInvitationsRepository.validateByTokenHash({ tokenHash, now: new Date() })
    this.throwForValidateResult(result)
    return result
  }

  private async createSession(userId: string, email: string): Promise<AuthSessionResult> {
    const accessToken = await this.tokenService.signAccessToken({ sub: userId, email })
    const refreshToken = this.tokenService.generateRefreshToken()

    await this.refreshTokenRepository.create({
      userId,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    })

    const user = await this.usersRepository.findById(userId)
    if (!user) {
      throw new UnauthorizedException('Authentication required')
    }

    const memberships = await this.membershipsRepository.findManyByUserId(user.id)
    const body: MeResponse = { user: mapAuthUser(user), memberships: memberships.map(mapMembership) }

    return { accessToken, refreshToken, body }
  }

  private throwForValidateResult(result: ValidateTeamInvitationResult): asserts result is Extract<ValidateTeamInvitationResult, { status: 'valid' }> {
    if (result.status === 'notFound') {
      throw new NotFoundException('Team invitation not found')
    }

    if (result.status === 'expired') {
      throw new GoneException('Team invitation has expired')
    }

    if (result.status === 'revoked') {
      throw new GoneException('Team invitation is no longer available')
    }

    if (result.status === 'alreadyAccepted') {
      throw new GoneException('Team invitation was already accepted')
    }
  }

  private throwForAcceptResult(result: Exclude<AcceptTeamInvitationResult, { status: 'accepted' }>): never {
    if (result.status === 'notFound') {
      throw new NotFoundException('Team invitation not found')
    }

    if (result.status === 'expired') {
      throw new GoneException('Team invitation has expired')
    }

    if (result.status === 'revoked') {
      throw new GoneException('Team invitation is no longer available')
    }

    if (result.status === 'alreadyAccepted') {
      throw new GoneException('Team invitation was already accepted')
    }

    if (result.status === 'alreadyMember') {
      throw new ConflictException('User is already a member of this tenant')
    }

    if (result.status === 'userAlreadyExists') {
      throw new ConflictException('Team invitation email is already registered')
    }

    if (result.status === 'emailMismatch') {
      throw new ForbiddenException('Team invitation belongs to another email')
    }

    throw new UnauthorizedException('Authentication required')
  }
}
