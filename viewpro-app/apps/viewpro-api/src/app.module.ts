import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth/auth.module'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'
import { OperatorsModule } from './operators/operators.module'
import { PlatformControlModule } from './platform-control/platform-control.module'
import { PlatformDataModule } from './platform-data/platform-data.module'

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          ttl: configService.get<number>('app.authRateLimit.login.ttlSeconds', 60) * 1000,
          limit: configService.get<number>('app.authRateLimit.login.limit', 5),
        },
      ],
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    PlatformControlModule,
    PlatformDataModule,
    OperatorsModule,
  ],
})
export class AppModule {}
