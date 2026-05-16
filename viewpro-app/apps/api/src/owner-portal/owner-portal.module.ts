import { Module } from '@nestjs/common'
import { AnalyticsCoreModule } from '../analytics/analytics-core.module'
import { AuthModule } from '../auth/auth.module'
import { OwnerPortalController } from './owner-portal.controller'
import { OWNER_PORTAL_REPOSITORY } from './owner-portal.repository'
import { PrismaOwnerPortalRepository } from './prisma-owner-portal.repository'
import { GetOwnerEngagementTimelineUseCase } from './use-cases/get-owner-engagement-timeline.use-case'
import { GetOwnerPropertyUseCase } from './use-cases/get-owner-property.use-case'
import { ListOwnerPropertiesUseCase } from './use-cases/list-owner-properties.use-case'
import { ListOwnerPropertyEngagementsUseCase } from './use-cases/list-owner-property-engagements.use-case'

const ownerPortalUseCases = [
  ListOwnerPropertiesUseCase,
  GetOwnerPropertyUseCase,
  ListOwnerPropertyEngagementsUseCase,
  GetOwnerEngagementTimelineUseCase,
]

@Module({
  imports: [AnalyticsCoreModule, AuthModule],
  controllers: [OwnerPortalController],
  providers: [{ provide: OWNER_PORTAL_REPOSITORY, useClass: PrismaOwnerPortalRepository }, ...ownerPortalUseCases],
  exports: [OWNER_PORTAL_REPOSITORY, ...ownerPortalUseCases],
})
export class OwnerPortalModule {}
