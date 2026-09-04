export type PropertyProposalState = 'BORRADOR' | 'EN_REVISION' | 'APROBADA' | 'RECHAZADA'
export type PropertyProposalReviewOutcome = 'APPROVED' | 'REJECTED'

const editableStates: PropertyProposalState[] = ['BORRADOR', 'RECHAZADA']

export class ProposalStateTransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProposalStateTransitionError'
  }
}

export function assertEditableProposalState(state: PropertyProposalState): void {
  if (!editableStates.includes(state)) {
    throw new ProposalStateTransitionError(`proposal is not editable from ${state}`)
  }
}

export function transitionProposalToReview(state: PropertyProposalState): 'EN_REVISION' {
  if (!editableStates.includes(state)) {
    throw new ProposalStateTransitionError(`cannot submit from ${state}`)
  }
  return 'EN_REVISION'
}

export function transitionReviewOutcome(
  state: PropertyProposalState,
  outcome: PropertyProposalReviewOutcome,
): 'RECHAZADA' | 'APROBADA' {
  if (state !== 'EN_REVISION') {
    throw new ProposalStateTransitionError(`cannot ${outcome === 'APPROVED' ? 'approve' : 'reject'} from ${state}`)
  }
  return outcome === 'APPROVED' ? 'APROBADA' : 'RECHAZADA'
}
