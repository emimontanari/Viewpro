import { Module } from '@nestjs/common'
import { ANALYTICS_REPOSITORY } from './analytics.repository'
import { AnalyticsService } from './analytics.service'
import { PrismaAnalyticsRepository } from './prisma-analytics.repository'

@Module({
  providers: [{ provide: ANALYTICS_REPOSITORY, useClass: PrismaAnalyticsRepository }, AnalyticsService],
  exports: [ANALYTICS_REPOSITORY, AnalyticsService],
})
export class AnalyticsModule {}
