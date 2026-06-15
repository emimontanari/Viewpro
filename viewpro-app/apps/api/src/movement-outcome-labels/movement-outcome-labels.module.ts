import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { MovementOutcomeLabelsController } from './movement-outcome-labels.controller'
import { MOVEMENT_OUTCOME_LABELS_REPOSITORY } from './movement-outcome-labels.repository'
import { PrismaMovementOutcomeLabelsRepository } from './prisma-movement-outcome-labels.repository'
import { CreateLabelUseCase } from './use-cases/create-label.use-case'
import { DeleteLabelUseCase } from './use-cases/delete-label.use-case'
import { ListLabelsUseCase } from './use-cases/list-labels.use-case'

const labelUseCases = [CreateLabelUseCase, ListLabelsUseCase, DeleteLabelUseCase]

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule],
  controllers: [MovementOutcomeLabelsController],
  providers: [
    { provide: MOVEMENT_OUTCOME_LABELS_REPOSITORY, useClass: PrismaMovementOutcomeLabelsRepository },
    ...labelUseCases,
  ],
  exports: [MOVEMENT_OUTCOME_LABELS_REPOSITORY, ...labelUseCases],
})
export class MovementOutcomeLabelsModule {}
