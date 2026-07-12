import { Inject, Injectable, UnprocessableEntityException } from '@nestjs/common'
import type { TenantMovementOutcomeLabel } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { CreateLabelDto } from '../dto/create-label.dto'
import { BUILT_IN_OUTCOME_NAMES_LOWER } from '../constants/built-in-outcome-names'
import {
  MOVEMENT_OUTCOME_LABELS_REPOSITORY,
  type MovementOutcomeLabelsRepository,
} from '../movement-outcome-labels.repository'

@Injectable()
export class CreateLabelUseCase {
  constructor(
    @Inject(MOVEMENT_OUTCOME_LABELS_REPOSITORY)
    private readonly labelsRepository: MovementOutcomeLabelsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    input: CreateLabelDto,
  ): Promise<TenantMovementOutcomeLabel> {
    // FR-7: label must not collide with built-in outcome names (case-insensitive)
    if (BUILT_IN_OUTCOME_NAMES_LOWER.has(input.label.toLowerCase())) {
      throw new UnprocessableEntityException({
        errorCode: 'LABEL_NAME_COLLIDES_BUILTIN',
        message: 'Label name collides with a built-in outcome value',
      })
    }

    // Create handles P2002 idempotency internally (R2 strategy in repository adapter).
    // Returns the existing active row on duplicate, or creates a fresh row (FR-13).
    return this.labelsRepository.create({
      tenantId: tenant.tenantId,
      label: input.label,
      color: input.color,
      createdByUserId: currentUser.id,
    })
  }
}
