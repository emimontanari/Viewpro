import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AuthController } from './auth.controller'
import { OPERATOR_REPOSITORY } from './repositories/operator.repository'
import { PrismaOperatorRepository } from './repositories/prisma-operator.repository'
import { Argon2PasswordHasher } from './security/argon2-password-hasher'
import { PASSWORD_HASHER } from './security/password-hasher'
import { TokenService } from './tokens/token.service'
import { AuthGuard } from './guards/auth.guard'
import { AuthThrottlerGuard } from './guards/auth-throttler.guard'
import { LoginUseCase } from './use-cases/login.use-case'
import { StepUpUseCase } from './use-cases/step-up.use-case'

@Module({
  imports: [
    ConfigModule,
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
    LoginUseCase,
    StepUpUseCase,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: OPERATOR_REPOSITORY, useClass: PrismaOperatorRepository },
  ],
  exports: [AuthGuard, TokenService],
})
export class AuthModule {}
