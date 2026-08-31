import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TenantRole } from '@prisma/client'
import { parseArContactPhone } from '../../common/phone/ar-contact-phone'
import { EMAIL_SENDER, type EmailSender } from '../../email/email-sender.port'
import type { RegisterTenantDto } from '../dto/register-tenant.dto'
import { mapAuthUser } from '../responses/auth-user.response'
import { mapMembership, type MeResponse } from '../responses/me.response'
import type { PasswordHasher } from '../security/password-hasher'
import { PASSWORD_HASHER } from '../security/password-hasher'
import { TokenService } from '../tokens/token.service'
import type { EmailVerificationTokenRepository } from '../tokens/email-verification-token.repository'
import { EMAIL_VERIFICATION_TOKEN_REPOSITORY } from '../tokens/email-verification-token.repository'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../tokens/refresh-token.repository'
import { normalizeEmail, slugify } from '../utils/slugify'
import type { AuthRegistrationRepository } from '../repositories/auth-registration.repository'
import { AUTH_REGISTRATION_REPOSITORY } from '../repositories/auth-registration.repository'
import type { TenantsRepository } from '../../tenants/tenants.repository'
import { TENANTS_REPOSITORY } from '../../tenants/tenants.repository'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'
import type { OwnerAccessRepository } from '../../owner-access/owner-access.repository'
import { OWNER_ACCESS_REPOSITORY } from '../../owner-access/owner-access.repository'

export type AuthSessionResult = {
  accessToken: string
  refreshToken: string
  body: MeResponse
}

@Injectable()
export class RegisterTenantUseCase {
  private readonly logger = new Logger(RegisterTenantUseCase.name)

  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(TENANTS_REPOSITORY) private readonly tenantsRepository: TenantsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(AUTH_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: AuthRegistrationRepository,
    @Inject(EMAIL_VERIFICATION_TOKEN_REPOSITORY)
    private readonly emailVerificationTokenRepository: EmailVerificationTokenRepository,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    // Appended last on purpose: the specs construct these positionally, so
    // inserting in the middle silently shifts every argument after it.
    @Inject(OWNER_ACCESS_REPOSITORY) private readonly ownerAccessRepository: OwnerAccessRepository,
  ) {}

  async execute(dto: RegisterTenantDto): Promise<AuthSessionResult> {
    // Mandatory agency contact phone (#287) — parsed FIRST, before any I/O.
    // Pure and cheap, avoids an argon2 hash on a request that will 400, and
    // keeps a garbage-phone submission from ever reaching the email-existence
    // lookup below (design.md ADR-3, enumeration-protection rationale).
    const phoneResult = parseArContactPhone(dto.whatsappPhone)
    if (!phoneResult.ok) {
      const { errorCode } = phoneResult
      throw new BadRequestException({ errorCode })
    }

    const email = normalizeEmail(dto.email)
    const existingUser = await this.usersRepository.findByEmail(email)

    if (existingUser) {
      throw new ConflictException('Email is already registered')
    }

    const tenantSlug = await this.generateUniqueSlug(dto.tenantName)
    const passwordHash = await this.passwordHasher.hash(dto.password)
    const { user, memberships } = await this.registrationRepository.registerTenant({
      email,
      passwordHash,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName?.trim() || undefined,
      tenantName: dto.tenantName.trim(),
      tenantSlug,
      role: TenantRole.PRINCIPAL_MANAGER,
      whatsappPhone: phoneResult.e164,
    })

    const { accessToken, refreshToken } = await this.createSession(user.id, user.email)

    await this.sendVerificationEmail(user.id, user.email)

    return {
      accessToken,
      refreshToken,
      body: {
        user: mapAuthUser(user),
        memberships: memberships.map(mapMembership),
        // Registering a tenant does not erase owner access this identity may
        // already hold: that is precisely the dual-context case (#326).
        hasOwnerAccess: await this.ownerAccessRepository.hasActiveOwnerAccess(user.id),
      },
    }
  }

  // Soft (non-blocking) email verification: registration must succeed even if
  // issuing or delivering the verification email fails.
  private async sendVerificationEmail(userId: string, email: string) {
    try {
      const rawToken = this.tokenService.generateEmailVerificationToken()
      await this.emailVerificationTokenRepository.create({
        userId,
        tokenHash: this.tokenService.hashEmailVerificationToken(rawToken),
        expiresAt: this.tokenService.getEmailVerificationExpiresAt(),
      })

      const publicUrl = this.configService.getOrThrow<string>('app.publicUrl')
      const verificationUrl = `${publicUrl.replace(/\/$/, '')}/auth/verify-email?token=${encodeURIComponent(rawToken)}`

      await this.emailSender.sendEmailVerification({ to: email, verificationUrl })
    } catch (error) {
      this.logger.error(
        `Failed to send email verification to ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
    }
  }

  private async createSession(userId: string, email: string) {
    const accessToken = await this.tokenService.signAccessToken({ sub: userId, email })
    const refreshToken = this.tokenService.generateRefreshToken()

    await this.refreshTokenRepository.create({
      userId,
      tokenHash: this.tokenService.hashRefreshToken(refreshToken),
      expiresAt: this.tokenService.getRefreshTokenExpiresAt(),
    })

    return { accessToken, refreshToken }
  }

  private async generateUniqueSlug(tenantName: string) {
    const baseSlug = slugify(tenantName) || 'tenant'
    let candidate = baseSlug
    let suffix = 2

    while (await this.tenantsRepository.findBySlug(candidate)) {
      candidate = `${baseSlug}-${suffix}`
      suffix += 1
    }

    return candidate
  }
}
