import type { PropertyProposal, PropertyProposalReviewRound } from '@prisma/client'
import type { ProposalResultLink } from './responses/property-proposal.response'
import type { StagedPropertyScalars } from './domain/normalization'
import type { PropertyProposalReviewFilters } from './review-filter-builder'

export const PROPERTY_PROPOSALS_REPOSITORY = Symbol('PROPERTY_PROPOSALS_REPOSITORY')

export type SellerPropertyProposalsPage = {
  items: PropertyProposal[]
  total: number
}

export type ReviewerPropertyProposalsPage = {
  items: PropertyProposal[]
  total: number
}

export type ReviewerPropertyProposalSummary = {
  proposal: PropertyProposal
  currentReviewRoundId?: string
  proposedBy: { id: string; firstName: string; lastName: string | null }
  resultLink: ProposalResultLink
}

export type ReviewerPropertyProposalSummariesPage = {
  items: ReviewerPropertyProposalSummary[]
  total: number
}

export type ReviewerPropertyProposalDetail = ReviewerPropertyProposalSummary & {
  history: Array<{
    id: string
    roundNumber: number
    submittedAt: Date
    submittedBy: { id: string; firstName: string; lastName: string | null }
    snapshot: StagedPropertyScalars
    decision: null | {
      outcome: string
      decidedAt: Date
      rejectionReason: string | null
      reviewer: { id: string; firstName: string; lastName: string | null }
    }
  }>
}

export type SellerPropertyProposalSummary = {
  proposal: PropertyProposal
  currentReviewRoundId?: string
  resultLink: ProposalResultLink
}

export type SellerPropertyProposalSummariesPage = {
  items: SellerPropertyProposalSummary[]
  total: number
}

export type SellerPropertyProposalDetail = SellerPropertyProposalSummary & {
  history: Array<{
    id: string
    roundNumber: number
    submittedAt: Date
    submittedBy: { id: string; firstName: string; lastName: string | null }
    snapshot: StagedPropertyScalars
    decision: null | {
      outcome: string
      decidedAt: Date
      rejectionReason: string | null
      reviewer: { id: string; firstName: string; lastName: string | null }
    }
  }>
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
  listSummariesForSeller?(input: {
    tenantId: string
    proposedByUserId: string
    page: number
    pageSize: number
  }): Promise<SellerPropertyProposalSummariesPage>
  findForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }): Promise<PropertyProposal | null>
  findDetailForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }): Promise<SellerPropertyProposalDetail | null>
  listForReviewer(input: {
    tenantId: string
    filters: PropertyProposalReviewFilters
  }): Promise<ReviewerPropertyProposalsPage>
  findForReviewer(input: {
    tenantId: string
    proposalId: string
  }): Promise<PropertyProposal | null>
  findDetailForReviewer(input: {
    tenantId: string
    reviewerUserId: string
    proposalId: string
  }): Promise<ReviewerPropertyProposalDetail | null>
  listSummariesForReviewer(input: {
    tenantId: string
    reviewerUserId: string
    filters: PropertyProposalReviewFilters
  }): Promise<ReviewerPropertyProposalSummariesPage>
}
