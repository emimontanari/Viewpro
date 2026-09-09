import { describe, expect, it } from 'vitest'
import { mapPropertyProposalSummaryTransport, mapPropertyProposalTransport } from './property-proposal.transport'

const createdAt = new Date('2026-09-14T10:00:00.000Z')
const updatedAt = new Date('2026-09-15T11:00:00.000Z')
const latestSubmittedAt = new Date('2026-09-16T12:00:00.000Z')

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    tenantId: 'tenant-secret',
    proposedByUserId: 'seller-secret',
    state: 'EN_REVISION',
    version: 2,
    title: 'Casa del parque',
    addressLine: 'Calle 1',
    city: 'Rosario',
    province: 'Santa Fe',
    propertyType: 'HOUSE',
    operationType: 'SALE',
    totalAreaSqm: 100,
    coveredAreaSqm: 80,
    rooms: 4,
    bedrooms: 3,
    bathrooms: 2,
    garages: 1,
    ageYears: 10,
    orientation: 'Norte',
    ownerName: 'Ada Lovelace',
    ownerEmail: 'ada@example.com',
    publishedPriceCents: 100_000,
    currency: 'ARS',
    latestSubmittedAt,
    createdAt,
    updatedAt,
    sourceEngagement: { id: 'engagement-secret' },
    assignment: { agentUserId: 'agent-secret' },
    membership: { role: 'MANAGER' },
    user: { email: 'secret@example.com' },
    enumerableSecret: 'do-not-disclose',
    ...overrides,
  }
}

describe('property proposal transport projection', () => {
  it('projects only literal public proposal scalars and timestamps', () => {
    const input = proposal()

    expect(mapPropertyProposalTransport(input)).toEqual({
      id: 'proposal-1',
      state: 'EN_REVISION',
      version: 2,
      title: 'Casa del parque',
      addressLine: 'Calle 1',
      city: 'Rosario',
      province: 'Santa Fe',
      propertyType: 'HOUSE',
      operationType: 'SALE',
      totalAreaSqm: 100,
      coveredAreaSqm: 80,
      rooms: 4,
      bedrooms: 3,
      bathrooms: 2,
      garages: 1,
      ageYears: 10,
      orientation: 'Norte',
      ownerName: 'Ada Lovelace',
      ownerEmail: 'ada@example.com',
      publishedPriceCents: 100_000,
      currency: 'ARS',
      latestSubmittedAt,
      createdAt,
      updatedAt,
    })
  })

  it('maps a list summary through the literal allowlist and omits unauthorized fields', () => {
    expect(mapPropertyProposalSummaryTransport(proposal(), 'round-1', {
      canonicalEngagementId: 'engagement-1',
    })).toEqual({
      id: 'proposal-1', state: 'EN_REVISION', version: 2, title: 'Casa del parque',
      currentReviewRoundId: 'round-1', canonicalEngagementId: 'engagement-1',
      latestSubmittedAt, createdAt, updatedAt,
    })
    expect(mapPropertyProposalSummaryTransport(proposal(), undefined, {})).not.toHaveProperty('canonicalEngagementId')
  })

  it('copies only an already-authorized canonical result ID and omits it when absent', () => {
    const input = proposal()
    const result = { canonicalEngagementId: 'engagement-1', tenantId: 'tenant-secret', sourceProposalId: 'proposal-1' }

    const output = mapPropertyProposalTransport(input, result)

    expect(output).toMatchObject({ canonicalEngagementId: 'engagement-1' })
    expect(output).not.toHaveProperty('tenantId')
    expect(output).not.toHaveProperty('sourceProposalId')
    expect(mapPropertyProposalTransport(input)).not.toHaveProperty('canonicalEngagementId')
    expect(mapPropertyProposalTransport(input, {})).not.toHaveProperty('canonicalEngagementId')
  })

  it('omits a hostile null canonical result ID', () => {
    const result = { canonicalEngagementId: null } as unknown as { canonicalEngagementId?: string }

    expect(mapPropertyProposalTransport(proposal(), result)).not.toHaveProperty('canonicalEngagementId')
  })

  it('preserves null scalars and dates without mutating either input', () => {
    const input = proposal({
      addressLine: null,
      city: null,
      province: null,
      propertyType: null,
      operationType: null,
      totalAreaSqm: null,
      coveredAreaSqm: null,
      rooms: null,
      bedrooms: null,
      bathrooms: null,
      garages: null,
      ageYears: null,
      orientation: null,
      ownerName: null,
      ownerEmail: null,
      publishedPriceCents: null,
      currency: null,
      latestSubmittedAt: null,
    })
    const result = { canonicalEngagementId: 'engagement-1', hostileExtra: 'do-not-disclose' }
    const beforeInput = structuredClone(input)
    const beforeResult = structuredClone(result)

    const output = mapPropertyProposalTransport(input, result)

    expect(output).toMatchObject({
      addressLine: null,
      city: null,
      province: null,
      propertyType: null,
      operationType: null,
      totalAreaSqm: null,
      coveredAreaSqm: null,
      rooms: null,
      bedrooms: null,
      bathrooms: null,
      garages: null,
      ageYears: null,
      orientation: null,
      ownerName: null,
      ownerEmail: null,
      publishedPriceCents: null,
      currency: null,
      latestSubmittedAt: null,
      canonicalEngagementId: 'engagement-1',
    })
    expect(output).not.toHaveProperty('hostileExtra')
    expect(input).toEqual(beforeInput)
    expect(result).toEqual(beforeResult)
  })
})
