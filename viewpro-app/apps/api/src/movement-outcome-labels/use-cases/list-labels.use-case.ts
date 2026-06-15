import { Inject, Injectable } from '@nestjs/common'
import type { TenantMovementOutcomeLabel } from '@prisma/client'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import type { ListLabelsQuery } from '../dto/list-labels.query'
import {
  MOVEMENT_OUTCOME_LABELS_REPOSITORY,
  type MovementOutcomeLabelsRepository,
} from '../movement-outcome-labels.repository'

@Injectable()
export class ListLabelsUseCase {
  constructor(
    @Inject(MOVEMENT_OUTCOME_LABELS_REPOSITORY)
    private readonly labelsRepository: MovementOutcomeLabelsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    query: Pick<ListLabelsQuery, 'activeOnly'>,
  ): Promise<TenantMovementOutcomeLabel[]> {
    return this.labelsRepository.findMany({
      tenantId: tenant.tenantId,
      activeOnly: query.activeOnly !== false, // default to true (FR-14)
    })
  }
}
