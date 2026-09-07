import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { PROPERTY_PROPOSALS_REPOSITORY, type PropertyProposalsRepository } from '../property-proposals.repository'

const reviewerRoles = new Set<TenantRole>([TenantRole.MANAGER, TenantRole.PRINCIPAL_MANAGER])

@Injectable()
export class GetPropertyProposalReviewUseCase {
  constructor(@Inject(PROPERTY_PROPOSALS_REPOSITORY) private readonly propertyProposalsRepository: PropertyProposalsRepository) {}

  async execute(tenant: TenantContext, _currentUser: CurrentUser, proposalId: string) {
    if (!reviewerRoles.has(tenant.role) || !tenant.permissions.includes(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)) {
      throw new ForbiddenException('Insufficient permissions')
    }
    const proposal = await this.propertyProposalsRepository.findForReviewer({ tenantId: tenant.tenantId, proposalId })
    if (!proposal) {
      throw new NotFoundException({ errorCode: 'PROPERTY_PROPOSAL_NOT_FOUND', message: 'Property proposal not found' })
    }
    return proposal
  }
}
