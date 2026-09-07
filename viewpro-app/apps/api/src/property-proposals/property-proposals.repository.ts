import type { PropertyProposal, PropertyProposalReviewRound } from '@prisma/client'
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

export type SubmitPropertyProposalInput = {
  tenantId: string
  proposedByUserId: string
  proposalId: string
  expectedVersion: number
}

export type SubmitPropertyProposalResult =
  | { kind: 'submitted'; proposal: PropertyProposal; round: PropertyProposalReviewRound }
  | { kind: 'notFound' | 'ineligible' | 'conflict' | 'incomplete' }

export type UpdatePropertyProposalInput = {
  tenantId: string
  proposedByUserId: string
  proposalId: string
  expectedVersion: number
  patch: Partial<StagedPropertyScalars>
}

export type UpdatePropertyProposalResult =
  | { kind: 'updated'; proposal: PropertyProposal }
  | { kind: 'replayed'; proposal: PropertyProposal }
  | { kind: 'notFound' | 'ineligible' | 'conflict' }

export type PropertyProposalsRepository = {
  createDraft(input: CreatePropertyProposalDraftInput): Promise<CreatePropertyProposalResult>
  submitForSeller(input: SubmitPropertyProposalInput): Promise<SubmitPropertyProposalResult>
  updateForSeller(input: UpdatePropertyProposalInput): Promise<UpdatePropertyProposalResult>
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
