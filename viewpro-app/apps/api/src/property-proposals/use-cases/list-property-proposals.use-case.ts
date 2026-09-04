import { Inject, Injectable } from '@nestjs/common'
import type { CurrentUser } from '../../auth/types/current-user'
import type { TenantContext } from '../../tenant-context/tenant-context.types'
import {
  PROPERTY_PROPOSALS_REPOSITORY,
  type PropertyProposalsRepository,
  type SellerPropertyProposalsPage,
} from '../property-proposals.repository'

export type ListPropertyProposalsQuery = { page?: number; pageSize?: number }
export type ListPropertyProposalsResult = SellerPropertyProposalsPage & { page: number; pageSize: number }

@Injectable()
export class ListPropertyProposalsUseCase {
  constructor(
    @Inject(PROPERTY_PROPOSALS_REPOSITORY)
    private readonly propertyProposalsRepository: PropertyProposalsRepository,
  ) {}

  async execute(
    tenant: TenantContext,
    currentUser: CurrentUser,
    query: ListPropertyProposalsQuery,
  ): Promise<ListPropertyProposalsResult> {
    const pageSize = normalizePageSize(query.pageSize)
    const page = normalizePage(query.page, pageSize)
    const result = await this.propertyProposalsRepository.listForSeller({
      tenantId: tenant.tenantId,
      proposedByUserId: currentUser.id,
      page,
      pageSize,
    })
    return { ...result, page, pageSize }
  }
}

function normalizePage(value: number | undefined, pageSize: number) {
  const page = isPositiveSafeInteger(value) ? value : 1
  return Number.isSafeInteger((page - 1) * pageSize) ? page : 1
}

function normalizePageSize(value: number | undefined) {
  return isPositiveSafeInteger(value) ? Math.min(value, 50) : 20
}

function isPositiveSafeInteger(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}
