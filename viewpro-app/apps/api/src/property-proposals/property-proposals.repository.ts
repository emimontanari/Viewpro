import type { PropertyProposal } from '@prisma/client'
import type { StagedPropertyScalars } from './domain/normalization'

export const PROPERTY_PROPOSALS_REPOSITORY = Symbol('PROPERTY_PROPOSALS_REPOSITORY')

export type SellerPropertyProposalsPage = {
  items: PropertyProposal[]
  total: number
}

export type CreatePropertyProposalDraftInput = StagedPropertyScalars & {
  tenantId: string
  proposedByUserId: string
  title: string
}

export type CreatePropertyProposalResult =
  | { kind: 'created'; proposal: PropertyProposal }
  | { kind: 'ineligible' }

export type PropertyProposalsRepository = {
  createDraft(input: CreatePropertyProposalDraftInput): Promise<CreatePropertyProposalResult>
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
