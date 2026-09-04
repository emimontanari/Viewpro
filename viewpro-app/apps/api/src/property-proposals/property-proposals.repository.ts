import type { PropertyProposal } from '@prisma/client'

export const PROPERTY_PROPOSALS_REPOSITORY = Symbol('PROPERTY_PROPOSALS_REPOSITORY')

export type SellerPropertyProposalsPage = {
  items: PropertyProposal[]
  total: number
}

export type PropertyProposalsRepository = {
  listForSeller(input: {
    tenantId: string
    proposedByUserId: string
    page: number
    pageSize: number
  }): Promise<SellerPropertyProposalsPage>
  findForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }): Promise<PropertyProposal | null>
}
