import type { ReviewerPropertyProposalSummary } from '../property-proposals.repository'

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
