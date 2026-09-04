import {
  createStagedScalarSnapshot,
  normalizeOptionalText,
  normalizeStagedScalars,
  STAGED_PROPERTY_SCALAR_KEYS,
  type StagedPropertyScalars,
  type StagedPropertyScalarsInput,
} from './normalization'
import type { PropertyProposalReviewOutcome } from './state-machine'

export type UpdateReplayIdentity = Readonly<{
  expectedVersion: number
  patch: Readonly<Partial<StagedPropertyScalars>>
}>

export type SubmitReplayIdentity = Readonly<{
  expectedVersion: number
  snapshot: Readonly<StagedPropertyScalars>
}>

export type ReviewReplayIdentity = Readonly<{
  roundId: string
  reviewerUserId: string
  outcome: PropertyProposalReviewOutcome
  rejectionReason: string | null
}>

function normalizeUpdatePatch(input: Partial<StagedPropertyScalarsInput>): Partial<StagedPropertyScalars> {
  const normalized = normalizeStagedScalars(input)
  const patch: Partial<StagedPropertyScalars> = {}

  if (input.title !== undefined) patch.title = normalized.title
  if (input.addressLine !== undefined) patch.addressLine = normalized.addressLine
  if (input.city !== undefined) patch.city = normalized.city
  if (input.province !== undefined) patch.province = normalized.province
  if (input.propertyType !== undefined) patch.propertyType = normalized.propertyType
  if (input.operationType !== undefined) patch.operationType = normalized.operationType
  if (input.totalAreaSqm !== undefined) patch.totalAreaSqm = normalized.totalAreaSqm
  if (input.coveredAreaSqm !== undefined) patch.coveredAreaSqm = normalized.coveredAreaSqm
  if (input.rooms !== undefined) patch.rooms = normalized.rooms
  if (input.bedrooms !== undefined) patch.bedrooms = normalized.bedrooms
  if (input.bathrooms !== undefined) patch.bathrooms = normalized.bathrooms
  if (input.garages !== undefined) patch.garages = normalized.garages
  if (input.ageYears !== undefined) patch.ageYears = normalized.ageYears
  if (input.orientation !== undefined) patch.orientation = normalized.orientation
  if (input.ownerName !== undefined) patch.ownerName = normalized.ownerName
  if (input.ownerEmail !== undefined) patch.ownerEmail = normalized.ownerEmail
  if (input.publishedPriceCents !== undefined) patch.publishedPriceCents = normalized.publishedPriceCents
  if (input.currency !== undefined) patch.currency = normalized.currency

  return patch
}

export function buildUpdateReplayIdentity(
  expectedVersion: number,
  patch: Partial<StagedPropertyScalarsInput>,
): UpdateReplayIdentity {
  return Object.freeze({ expectedVersion, patch: Object.freeze(normalizeUpdatePatch(patch)) })
}

export function matchesUpdateReplayIdentity(
  stored: UpdateReplayIdentity,
  attempted: UpdateReplayIdentity,
): boolean {
  return stored.expectedVersion === attempted.expectedVersion
    && STAGED_PROPERTY_SCALAR_KEYS.every((field) => Object.hasOwn(stored.patch, field)
      === Object.hasOwn(attempted.patch, field)
      && stored.patch[field] === attempted.patch[field])
}

export function buildSubmitReplayIdentity(
  expectedVersion: number,
  snapshot: Partial<StagedPropertyScalarsInput>,
): SubmitReplayIdentity {
  return Object.freeze({
    expectedVersion,
    snapshot: createStagedScalarSnapshot(normalizeStagedScalars(snapshot)),
  })
}

export function matchesSubmitReplayIdentity(
  stored: SubmitReplayIdentity,
  attempted: SubmitReplayIdentity,
): boolean {
  return stored.expectedVersion === attempted.expectedVersion
    && STAGED_PROPERTY_SCALAR_KEYS.every((field) => stored.snapshot[field] === attempted.snapshot[field])
}

export function buildReviewReplayIdentity(input: {
  roundId: string
  reviewerUserId: string
  outcome: PropertyProposalReviewOutcome
  rejectionReason?: string | null
}): ReviewReplayIdentity {
  return Object.freeze({
    roundId: input.roundId,
    reviewerUserId: input.reviewerUserId,
    outcome: input.outcome,
    rejectionReason: input.outcome === 'REJECTED' ? normalizeOptionalText(input.rejectionReason) : null,
  })
}

export function matchesReviewReplayIdentity(
  stored: ReviewReplayIdentity,
  attempted: ReviewReplayIdentity,
): boolean {
  return stored.roundId === attempted.roundId
    && stored.reviewerUserId === attempted.reviewerUserId
    && stored.outcome === attempted.outcome
    && stored.rejectionReason === attempted.rejectionReason
}
