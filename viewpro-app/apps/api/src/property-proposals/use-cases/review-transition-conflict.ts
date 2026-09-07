type Decision = { reviewerUserId: string; outcome: 'APPROVED' | 'REJECTED'; rejectionReason: string | null }

type Input = {
  state: string
  round: { id: string }
  decision: Decision | null
  roundId: string
  reviewerUserId: string
  reason: string
}

export function classifyRejectionTransition(input: Input): 'reject' | 'replay' | 'conflict' {
  if (input.state === 'EN_REVISION' && input.round.id === input.roundId && input.decision === null) return 'reject'
  if (input.state === 'RECHAZADA' && input.round.id === input.roundId
    && input.decision?.reviewerUserId === input.reviewerUserId
    && input.decision.outcome === 'REJECTED' && input.decision.rejectionReason === input.reason) return 'replay'
  return 'conflict'
}
