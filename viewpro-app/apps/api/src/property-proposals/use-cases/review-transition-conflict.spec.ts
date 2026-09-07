import { describe, expect, it } from 'vitest'
import { classifyRejectionTransition } from './review-transition-conflict'

const round = { id: 'round-1' }
const rejected = { reviewerUserId: 'manager-1', outcome: 'REJECTED' as const, rejectionReason: 'Needs photos' }

describe('classifyRejectionTransition', () => {
  it('permits only the undecided current EN_REVISION round', () => {
    expect(classifyRejectionTransition({ state: 'EN_REVISION', round, decision: null, roundId: round.id, reviewerUserId: 'manager-1', reason: 'Needs photos' })).toBe('reject')
  })

  it('replays only the exact durable actor, outcome, round, and normalized reason', () => {
    expect(classifyRejectionTransition({ state: 'RECHAZADA', round, decision: rejected, roundId: round.id, reviewerUserId: 'manager-1', reason: 'Needs photos' })).toBe('replay')
    for (const change of [
      { roundId: 'round-stale' }, { reviewerUserId: 'manager-2' }, { reason: 'Other reason' },
      { decision: { ...rejected, outcome: 'APPROVED' as const } }, { state: 'APROBADA' as const },
      { state: 'RECHAZADA' as const, decision: null },
    ]) expect(classifyRejectionTransition({ state: 'RECHAZADA', round, decision: rejected, roundId: round.id, reviewerUserId: 'manager-1', reason: 'Needs photos', ...change })).toBe('conflict')
  })
})
