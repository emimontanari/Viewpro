import { Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_PROPOSALS_REPOSITORY,
  type PropertyProposalsRepository,
} from '../property-proposals.repository'

@Injectable()
export class GetPropertyProposalUseCase {
  constructor(
    @Inject(PROPERTY_PROPOSALS_REPOSITORY)
    private readonly propertyProposalsRepository: PropertyProposalsRepository,
  ) {}

  execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string) {
    return this.propertyProposalsRepository.findForSeller({
      tenantId: tenant.tenantId,
      proposedByUserId: currentUser.id,
      proposalId,
    })
  }
}
