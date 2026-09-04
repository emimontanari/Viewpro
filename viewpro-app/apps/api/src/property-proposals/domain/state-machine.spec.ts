import { describe, expect, it } from 'vitest'
import {
  ProposalStateTransitionError,
  assertEditableProposalState,
  transitionProposalToReview,
  transitionReviewOutcome,
  type PropertyProposalReviewOutcome,
  type PropertyProposalState,
} from './state-machine'

const proposalStates: PropertyProposalState[] = [
  'BORRADOR',
  'EN_REVISION',
  'APROBADA',
  'RECHAZADA',
]

const reviewOutcomes: PropertyProposalReviewOutcome[] = ['APPROVED', 'REJECTED']

function attemptReviewTransition(
  state: PropertyProposalState,
  outcome: PropertyProposalReviewOutcome,
): 'RECHAZADA' | 'APROBADA' | null {
  try {
    return transitionReviewOutcome(state, outcome)
  } catch (error) {
    if (error instanceof ProposalStateTransitionError) return null
    throw error
  }
}

const reviewTransitionCases = reviewOutcomes.flatMap((outcome) => proposalStates.map((state) => ({
  state,
  outcome,
  target: state === 'EN_REVISION' ? (outcome === 'APPROVED' ? 'APROBADA' : 'RECHAZADA') : null,
})))

describe('property proposal state machine', () => {
  it('permits saves only in BORRADOR and RECHAZADA', () => {
    expect(() => assertEditableProposalState('BORRADOR')).not.toThrow()
    expect(() => assertEditableProposalState('RECHAZADA')).not.toThrow()
    expect(() => assertEditableProposalState('EN_REVISION')).toThrow(ProposalStateTransitionError)
    expect(() => assertEditableProposalState('APROBADA')).toThrow(ProposalStateTransitionError)
  })

  it('moves submit and resubmit from editable states to EN_REVISION', () => {
    expect(transitionProposalToReview('BORRADOR')).toBe('EN_REVISION')
    expect(transitionProposalToReview('RECHAZADA')).toBe('EN_REVISION')
    expect(() => transitionProposalToReview('EN_REVISION')).toThrow('cannot submit')
    expect(() => transitionProposalToReview('APROBADA')).toThrow('cannot submit')
  })

  it.each(reviewTransitionCases)('allows $outcome from $state only when target is EN_REVISION', ({ state, outcome, target }) => {
    expect(attemptReviewTransition(state, outcome)).toBe(target)
  })
})
