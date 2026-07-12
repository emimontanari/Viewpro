import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  MOVEMENT_OUTCOME_LABELS_REPOSITORY,
  type MovementOutcomeLabelsRepository,
} from '../movement-outcome-labels.repository'

const managerRoles = new Set<TenantRole>([TenantRole.MANAGER, TenantRole.PRINCIPAL_MANAGER])

@Injectable()
export class DeleteLabelUseCase {
  constructor(
    @Inject(MOVEMENT_OUTCOME_LABELS_REPOSITORY)
    private readonly labelsRepository: MovementOutcomeLabelsRepository,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, labelId: string): Promise<void> {
    const label = await this.labelsRepository.findByIdForTenant({
      id: labelId,
      tenantId: tenant.tenantId,
    })

    // Cross-tenant reads return 404, not 403 (FR-26 — do not leak existence)
    if (!label) {
      throw new NotFoundException('Label not found')
    }

    // 409 if already deleted (design error envelope — LABEL_ALREADY_DELETED)
    if (label.deletedAt !== null) {
      throw new ConflictException({
        errorCode: 'LABEL_ALREADY_DELETED',
        message: 'Label has already been deleted',
      })
    }

    // Authorization: creator OR MANAGER / PRINCIPAL_MANAGER (FR-15, S-14, S-15)
    const isCreator = label.createdByUserId === currentUser.id
    const isManager = managerRoles.has(tenant.role)

    if (!isCreator && !isManager) {
      throw new ForbiddenException('Only the label creator or a manager can delete this label')
    }

    await this.labelsRepository.softDelete({ id: labelId, tenantId: tenant.tenantId })
  }
}
