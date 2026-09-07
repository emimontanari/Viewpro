import { normalizeStagedScalars, type StagedPropertyScalarsInput } from '../domain/normalization'

export function mapPropertyProposalSnapshot(proposal: Partial<StagedPropertyScalarsInput>) {
  return normalizeStagedScalars(proposal)
}
