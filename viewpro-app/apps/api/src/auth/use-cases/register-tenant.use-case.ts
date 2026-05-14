import { ConflictException, Inject, Injectable } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import type { RegisterTenantDto } from '../dto/register-tenant.dto'
import { mapAuthUser } from '../responses/auth-user.response'
import { mapMembership, type MeResponse } from '../responses/me.response'
import type { PasswordHasher } from '../security/password-hasher'
import { PASSWORD_HASHER } from '../security/password-hasher'
import { TokenService } from '../tokens/token.service'
import type { RefreshTokenRepository } from '../tokens/refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from '../tokens/refresh-token.repository'
import { normalizeEmail, slugify } from '../utils/slugify'
import type { AuthRegistrationRepository } from '../repositories/auth-registration.repository'
import { AUTH_REGISTRATION_REPOSITORY } from '../repositories/auth-registration.repository'
import type { TenantsRepository } from '../../tenants/tenants.repository'
import { TENANTS_REPOSITORY } from '../../tenants/tenants.repository'
import type { UsersRepository } from '../../users/users.repository'
import { USERS_REPOSITORY } from '../../users/users.repository'

export type AuthSessionResult = {
  accessToken: string
  refreshToken: string
  body: MeResponse
}

@Injectable()
export class RegisterTenantUseCase {
  constructor(
    @Inject(USERS_REPOSITORY) private readonly usersRepository: UsersRepository,
    @Inject(TENANTS_REPOSITORY) private readonly tenantsRepository: TenantsRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokenRepository: RefreshTokenRepository,
    @Inject(AUTH_REGISTRATION_REPOSITORY)
    private readonly registrationRepository: AuthRegistrationRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: RegisterTenantDto): Promise<AuthSessionResult> {
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
    })

    const { accessToken, refreshToken } = await this.createSession(user.id, user.email)

    return {
      accessToken,
      refreshToken,
      body: { user: mapAuthUser(user), memberships: memberships.map(mapMembership) },
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
