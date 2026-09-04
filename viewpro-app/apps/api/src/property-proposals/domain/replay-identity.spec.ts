import { describe, expect, it } from 'vitest'
import {
  buildReviewReplayIdentity,
  buildSubmitReplayIdentity,
  buildUpdateReplayIdentity,
  matchesReviewReplayIdentity,
  matchesSubmitReplayIdentity,
  matchesUpdateReplayIdentity,
} from './replay-identity'

describe('property proposal replay identity', () => {
  it('matches only the same normalized update version and allowlisted patch', () => {
    const patch = { title: ' Casa ', propertyType: ' HOUSE ', ownerName: ' ', ignored: 'discarded' }
    const saved = buildUpdateReplayIdentity(4, patch)
    patch.title = 'Changed'
    patch.propertyType = 'APARTMENT'

    expect(saved.patch).toEqual({ title: 'Casa', propertyType: 'HOUSE', ownerName: null })
    expect(Object.isFrozen(saved.patch)).toBe(true)
    expect(matchesUpdateReplayIdentity(saved, buildUpdateReplayIdentity(4, {
      title: 'Casa', propertyType: 'HOUSE', ownerName: null,
    }))).toBe(true)
    expect(matchesUpdateReplayIdentity(saved, buildUpdateReplayIdentity(5, {
      title: 'Casa', propertyType: 'HOUSE', ownerName: null,
    }))).toBe(false)
    expect(matchesUpdateReplayIdentity(saved, buildUpdateReplayIdentity(4, {
      title: 'Different', propertyType: 'HOUSE', ownerName: null,
    }))).toBe(false)
  })

  it('matches only the same normalized submit version and immutable snapshot', () => {
    const input = {
      title: ' Casa ', addressLine: ' Calle 1 ', city: ' Córdoba ', province: ' Córdoba ',
      propertyType: ' HOUSE ', operationType: ' SALE ',
    }
    const saved = buildSubmitReplayIdentity(7, input)
    input.title = 'Changed'
    input.propertyType = 'APARTMENT'

    expect(Object.isFrozen(saved.snapshot)).toBe(true)
    expect(matchesSubmitReplayIdentity(saved, buildSubmitReplayIdentity(7, {
      title: 'Casa', addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba',
      propertyType: 'HOUSE', operationType: 'SALE',
    }))).toBe(true)
    expect(matchesSubmitReplayIdentity(saved, buildSubmitReplayIdentity(8, {
      title: 'Casa', addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba',
      propertyType: 'HOUSE', operationType: 'SALE',
    }))).toBe(false)
    expect(matchesSubmitReplayIdentity(saved, buildSubmitReplayIdentity(7, {
      title: 'Other', addressLine: 'Calle 1', city: 'Córdoba', province: 'Córdoba',
      propertyType: 'HOUSE', operationType: 'SALE',
    }))).toBe(false)
  })

  it('matches review identities only when all canonical fields agree', () => {
    const rejected = buildReviewReplayIdentity({
      roundId: 'round-1', reviewerUserId: 'reviewer-1', outcome: 'REJECTED', rejectionReason: '  Missing plan  ',
    })
    const mismatches = [
      buildReviewReplayIdentity({ ...rejected, roundId: 'round-2' }),
      buildReviewReplayIdentity({ ...rejected, reviewerUserId: 'reviewer-2' }),
      buildReviewReplayIdentity({ ...rejected, outcome: 'APPROVED' }),
      buildReviewReplayIdentity({ ...rejected, rejectionReason: 'Different plan' }),
    ]

    expect(matchesReviewReplayIdentity(rejected, buildReviewReplayIdentity({
      ...rejected, rejectionReason: 'Missing plan',
    }))).toBe(true)
    for (const mismatch of mismatches) expect(matchesReviewReplayIdentity(rejected, mismatch)).toBe(false)
  })

  it('normalizes approved reasons to the canonical null identity', () => {
    const approved = buildReviewReplayIdentity({
      roundId: 'round-1', reviewerUserId: 'reviewer-1', outcome: 'APPROVED', rejectionReason: 'ignored',
    })

    expect(approved.rejectionReason).toBeNull()
    expect(matchesReviewReplayIdentity(approved, buildReviewReplayIdentity({
      ...approved, rejectionReason: 'also ignored',
    }))).toBe(true)
  })
})
