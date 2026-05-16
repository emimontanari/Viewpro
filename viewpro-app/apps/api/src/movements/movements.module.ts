import { Module } from '@nestjs/common'
import { AnalyticsCoreModule } from '../analytics/analytics-core.module'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { PropertyEngagementsModule } from '../property-engagements/property-engagements.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { MovementsController } from './movements.controller'
import { PrismaMovementsRepository } from './prisma-movements.repository'
import { MOVEMENTS_REPOSITORY } from './movements.repository'
import { CreateMovementUseCase } from './use-cases/create-movement.use-case'
import { ListMovementsUseCase } from './use-cases/list-movements.use-case'

const movementUseCases = [CreateMovementUseCase, ListMovementsUseCase]

@Module({
  imports: [AnalyticsCoreModule, AuthModule, MembershipsModule, PermissionsModule, TenantContextModule, PropertyEngagementsModule],
  controllers: [MovementsController],
  providers: [{ provide: MOVEMENTS_REPOSITORY, useClass: PrismaMovementsRepository }, ...movementUseCases],
  exports: [MOVEMENTS_REPOSITORY, ...movementUseCases],
})
export class MovementsModule {}
