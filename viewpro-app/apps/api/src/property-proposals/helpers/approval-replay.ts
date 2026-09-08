type ApprovalReplayInput = {
  proposalState: string
  requestedRoundId: string
  roundId: string
  decision: { reviewerUserId: string; outcome: string } | null
  reviewerUserId: string
  hasSameTenantSource: boolean
}

export function isApprovalReplay(input: ApprovalReplayInput): boolean {
  return input.proposalState === 'APROBADA'
    && input.requestedRoundId === input.roundId
    && input.decision?.reviewerUserId === input.reviewerUserId
    && input.decision.outcome === 'APPROVED'
    && input.hasSameTenantSource
}
