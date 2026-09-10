import type { ReviewerPropertyProposalDetail, ReviewerPropertyProposalSummary } from '../property-proposals.repository'
import { mapPropertyProposalSnapshot } from '../helpers/map-property-proposal'
import { mapPropertyProposalTransport, type PropertyProposalTransport } from './property-proposal.transport'

export function mapReviewerDetailTransport({
  proposal,
  proposedBy,
  currentReviewRoundId,
  history,
  resultLink,
}: ReviewerPropertyProposalDetail): PropertyProposalTransport & {
  proposedBy: { id: string; firstName: string; lastName: string | null }
  currentReviewRoundId?: string
  history: ReviewerPropertyProposalDetail['history']
} {
  const response: PropertyProposalTransport & {
    proposedBy: { id: string; firstName: string; lastName: string | null }
    currentReviewRoundId?: string
    history: ReviewerPropertyProposalDetail['history']
  } = {
    ...mapPropertyProposalTransport(proposal, resultLink),
    proposedBy: { id: proposedBy.id, firstName: proposedBy.firstName, lastName: proposedBy.lastName },
    history: history.map((round) => ({
      id: round.id,
      roundNumber: round.roundNumber,
      submittedAt: round.submittedAt,
      submittedBy: { id: round.submittedBy.id, firstName: round.submittedBy.firstName, lastName: round.submittedBy.lastName },
      snapshot: mapPropertyProposalSnapshot(round.snapshot),
      decision: round.decision && {
        outcome: round.decision.outcome,
        decidedAt: round.decision.decidedAt,
        rejectionReason: round.decision.rejectionReason,
        reviewer: {
          id: round.decision.reviewer.id,
          firstName: round.decision.reviewer.firstName,
          lastName: round.decision.reviewer.lastName,
        },
      },
    })),
  }
  if (currentReviewRoundId) response.currentReviewRoundId = currentReviewRoundId
  return response
}

export function mapReviewerSummaryTransport({
  proposal,
  currentReviewRoundId,
  proposedBy,
  resultLink,
}: ReviewerPropertyProposalSummary) {
  const response: { canonicalEngagementId?: string } & Record<string, unknown> = {
    id: proposal.id,
    state: proposal.state,
    version: proposal.version,
    title: proposal.title,
    currentReviewRoundId,
    latestSubmittedAt: proposal.latestSubmittedAt,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    proposedBy: {
      id: proposedBy.id,
      firstName: proposedBy.firstName,
      lastName: proposedBy.lastName,
    },
  }
  if (resultLink.canonicalEngagementId) response.canonicalEngagementId = resultLink.canonicalEngagementId
  return response
}
