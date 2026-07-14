import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AnalyticsCoreModule } from '../analytics/analytics-core.module'
import { DatabaseModule } from '../database/database.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PlatformDataModule } from '../platform-data/platform-data.module'
import { TenantsModule } from '../tenants/tenants.module'
import { UsersModule } from '../users/users.module'
import { AuthController } from './auth.controller'
import { AUTH_REGISTRATION_REPOSITORY } from './repositories/auth-registration.repository'
import { PrismaAuthRegistrationRepository } from './repositories/prisma-auth-registration.repository'
import { Argon2PasswordHasher } from './security/argon2-password-hasher'
import { PASSWORD_HASHER } from './security/password-hasher'
import { PrismaRefreshTokenRepository } from './tokens/prisma-refresh-token.repository'
import { REFRESH_TOKEN_REPOSITORY } from './tokens/refresh-token.repository'
import { TokenService } from './tokens/token.service'
import { AuthGuard } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { GetCurrentUserUseCase } from './use-cases/get-current-user.use-case'
import { LoginUseCase } from './use-cases/login.use-case'
import { LogoutUseCase } from './use-cases/logout.use-case'
import { RefreshSessionUseCase } from './use-cases/refresh-session.use-case'
import { RegisterTenantUseCase } from './use-cases/register-tenant.use-case'

@Module({
  imports: [
    ConfigModule,
    AnalyticsCoreModule,
    DatabaseModule,
    UsersModule,
    TenantsModule,
    MembershipsModule,
    // A4: PlatformDataModule exports PlatformOutboxWriter so PrismaAuthRegistrationRepository
    // can inject it. Mirrors the admin.module.ts pattern (no circular dependency:
    // PlatformDataModule imports neither AuthModule nor AdminModule).
    PlatformDataModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.auth.accessTokenSecret'),
        signOptions: {
          expiresIn: configService.get<number>('app.auth.accessTokenTtlSeconds') ?? 900,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    TokenService,
    AuthGuard,
    AuthThrottlerGuard,
    RegisterTenantUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    GetCurrentUserUseCase,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: PrismaRefreshTokenRepository },
    { provide: AUTH_REGISTRATION_REPOSITORY, useClass: PrismaAuthRegistrationRepository },
  ],
  exports: [
    AuthGuard,
    AuthThrottlerGuard,
    TokenService,
    PASSWORD_HASHER,
    REFRESH_TOKEN_REPOSITORY,
  ],
})
export class AuthModule {}
