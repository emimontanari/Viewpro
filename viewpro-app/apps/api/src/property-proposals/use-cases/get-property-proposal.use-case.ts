import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_PROPOSALS_REPOSITORY,
  type PropertyProposalsRepository,
} from '../property-proposals.repository'
import { mapPropertyProposalDetailTransport } from '../responses/property-proposal.transport'

@Injectable()
export class GetPropertyProposalUseCase {
  constructor(
    @Inject(PROPERTY_PROPOSALS_REPOSITORY)
    private readonly propertyProposalsRepository: PropertyProposalsRepository,
  ) {}

  async execute(tenant: TenantContext, currentUser: CurrentUser, proposalId: string) {
    const input = { tenantId: tenant.tenantId, proposedByUserId: currentUser.id, proposalId }
    const detail = await this.propertyProposalsRepository.findDetailForSeller(input)
    if (!detail) throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })
    return mapPropertyProposalDetailTransport(detail.proposal, detail.resultLink, detail)
  }
}
