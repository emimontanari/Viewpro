import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { ConfigModule } from './config/config.module'
import { DatabaseModule } from './database/database.module'
import { HealthModule } from './health/health.module'

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
    HealthModule,
  ],
})
export class AppModule {}
