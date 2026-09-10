import { ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import { PERMISSIONS } from '../../permissions/permissions.constants'
import { normalizeReviewerRead, type PropertyProposalReviewFilters } from '../review-filter-builder'
import { PROPERTY_PROPOSALS_REPOSITORY, type PropertyProposalsRepository } from '../property-proposals.repository'
import { mapReviewerSummaryTransport } from '../responses/property-proposal-review.transport'

const reviewerRoles = new Set<TenantRole>([TenantRole.MANAGER, TenantRole.PRINCIPAL_MANAGER])

@Injectable()
export class ListPropertyProposalReviewUseCase {
  constructor(@Inject(PROPERTY_PROPOSALS_REPOSITORY) private readonly propertyProposalsRepository: PropertyProposalsRepository) {}

  async execute(tenant: TenantContext, _currentUser: CurrentUser, filters: PropertyProposalReviewFilters) {
    if (!reviewerRoles.has(tenant.role) || !tenant.permissions.includes(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)) {
      throw new ForbiddenException('Insufficient permissions')
    }
    const result = await this.propertyProposalsRepository.listSummariesForReviewer({
      tenantId: tenant.tenantId,
      reviewerUserId: _currentUser.id,
      filters,
    })
    const { page, pageSize } = normalizeReviewerRead(filters)
    return { items: result.items.map(mapReviewerSummaryTransport), total: result.total, page, pageSize }
  }
}
