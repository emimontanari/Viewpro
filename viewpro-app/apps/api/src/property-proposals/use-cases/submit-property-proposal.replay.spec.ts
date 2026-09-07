import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PrismaPropertyProposalsRepository } from '../prisma-property-proposals.repository'
import { SubmitPropertyProposalUseCase } from './submit-property-proposal.use-case'

const staged = {
  id: 'proposal-1', tenantId: 'tenant-1', proposedByUserId: 'seller-1', state: 'RECHAZADA', version: 7,
  title: '  Casa  ', addressLine: '  Calle 1 ', city: ' Rosario ', province: ' Santa Fe ', propertyType: 'HOUSE', operationType: 'SALE',
  totalAreaSqm: 120, coveredAreaSqm: 80, rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 7,
  orientation: ' Norte ', ownerName: ' Ana ', ownerEmail: ' owner@example.test ', publishedPriceCents: 12_500_000, currency: ' ARS ',
  latestSubmittedAt: new Date('2026-09-01T12:00:00.000Z'),
}
const input = { tenantId: 'tenant-1', proposedByUserId: 'seller-1', proposalId: 'proposal-1', expectedVersion: 7 }
const priorRound = { id: 'round-2', proposalId: staged.id, tenantId: staged.tenantId, roundNumber: 2 }

function transaction(proposal = staged, latestRound = priorRound) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'locked' }]),
    propertyProposal: { findFirst: vi.fn().mockResolvedValue(proposal), update: vi.fn().mockImplementation(({ data }) => ({ ...proposal, ...data, version: proposal.version + 1 })) },
    propertyProposalReviewRound: { findFirst: vi.fn().mockResolvedValue(latestRound), create: vi.fn().mockImplementation(({ data }) => ({ id: 'round-3', ...data })) },
  }
  const prisma = { $transaction: vi.fn().mockImplementation((callback) => callback(tx)) }
  return { tx, repository: new PrismaPropertyProposalsRepository(prisma as never) }
}

describe('PrismaPropertyProposalsRepository rejected submission replay', () => {
  it('retains locked durable history and appends the next complete snapshot from RECHAZADA', async () => {
    const { tx, repository } = transaction()

    await expect(repository.submitForSeller(input)).resolves.toMatchObject({
      kind: 'submitted', proposal: { state: 'EN_REVISION', version: 8 }, round: { id: 'round-3', roundNumber: 3 },
    })

    const round = tx.propertyProposalReviewRound.create.mock.calls[0]?.[0].data
    expect(round).toEqual({
      tenantId: 'tenant-1', proposalId: 'proposal-1', roundNumber: 3, submittedByUserId: 'seller-1', submittedAt: expect.any(Date),
      title: 'Casa', addressLine: 'Calle 1', city: 'Rosario', province: 'Santa Fe', propertyType: 'HOUSE', operationType: 'SALE',
      totalAreaSqm: 120, coveredAreaSqm: 80, rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 7,
      orientation: 'Norte', ownerName: 'Ana', ownerEmail: 'owner@example.test', publishedPriceCents: 12_500_000, currency: 'ARS',
    })
    expect(tx.propertyProposal.update).toHaveBeenCalledWith({
      where: { id: 'proposal-1' }, data: { state: 'EN_REVISION', latestSubmittedAt: round.submittedAt, version: { increment: 1 } },
    })
  })

  it('returns the durable matching round without a duplicate write on exact replay', async () => {
    const replayed = { ...staged, state: 'EN_REVISION', version: 8 }
    const matchingRound = { ...priorRound, id: 'round-3', roundNumber: 3,
      title: 'Casa', addressLine: 'Calle 1', city: 'Rosario', province: 'Santa Fe', propertyType: 'HOUSE', operationType: 'SALE',
      totalAreaSqm: 120, coveredAreaSqm: 80, rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 7,
      orientation: 'Norte', ownerName: 'Ana', ownerEmail: 'owner@example.test', publishedPriceCents: 12_500_000, currency: 'ARS' }
    const { tx, repository } = transaction(replayed, matchingRound)

    await expect(repository.submitForSeller(input)).resolves.toEqual({ kind: 'submitted', proposal: replayed, round: matchingRound })
    expect(tx.propertyProposalReviewRound.create).not.toHaveBeenCalled()
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it.each(Object.entries({
    title: 'Apartment', addressLine: 'Other 1', city: 'Cordoba', province: 'Cordoba', propertyType: 'APARTMENT', operationType: 'RENT', totalAreaSqm: 121,
    coveredAreaSqm: 80, rooms: 4, bedrooms: 3, bathrooms: 2, garages: 1, ageYears: 7, orientation: 'Sur', ownerName: 'Ana', ownerEmail: 'ana@example.test', publishedPriceCents: 1, currency: 'USD',
  }))('rejects replay when the %s snapshot field differs, including nullable scalars and enum/string values', async (field, value) => {
    const replayed = { ...staged, state: 'EN_REVISION', version: 8, coveredAreaSqm: null, rooms: null, bedrooms: null, bathrooms: null, garages: null, ageYears: null, orientation: null, ownerName: null, ownerEmail: null, publishedPriceCents: null, currency: null }
    const matchingRound = { ...priorRound, ...replayed, id: 'round-3', roundNumber: 3 }
    const { tx, repository } = transaction(replayed as unknown as typeof staged, { ...matchingRound, [field]: value })

    await expect(repository.submitForSeller(input)).resolves.toEqual({ kind: 'conflict' })
    expect(tx.propertyProposalReviewRound.create).not.toHaveBeenCalled()
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it('invokes the resubmission transaction in the required lock and write order', async () => {
    const order: string[] = []
    const tx = {
      $queryRaw: vi.fn().mockImplementation(() => { const step = ['proposal lock', 'active user lock', 'active AGENT membership lock'][order.filter((entry) => entry.includes('lock')).length]; order.push(step!); return [{ id: 'locked' }] }),
      propertyProposal: { findFirst: vi.fn(() => { order.push('authoritative reread'); return staged }), update: vi.fn(({ data }) => { order.push('proposal update'); return { ...staged, ...data, version: 8 } }) },
      propertyProposalReviewRound: { findFirst: vi.fn(() => { order.push('latest-round read'); return priorRound }), create: vi.fn(({ data }) => { order.push('round create'); return { id: 'round-3', ...data } }) },
    }
    const repository = new PrismaPropertyProposalsRepository({ $transaction: (callback: (transaction: typeof tx) => unknown) => callback(tx) } as never)

    await expect(repository.submitForSeller(input)).resolves.toMatchObject({ kind: 'submitted' })
    expect(order).toEqual(['proposal lock', 'authoritative reread', 'active user lock', 'active AGENT membership lock', 'latest-round read', 'round create', 'proposal update'])
  })

  it.each([
    ['stale expected version', 6, { ...staged, state: 'EN_REVISION', version: 8 }, priorRound],
    ['future expected version', 8, staged, priorRound],
    ['different durable snapshot', 7, { ...staged, state: 'EN_REVISION', version: 8 }, { ...priorRound, roundNumber: 3, city: 'Cordoba' }],
    ['approved state', 7, { ...staged, state: 'APROBADA' }, priorRound],
  ])('keeps %s scoped as a conflict without a write', async (_name, expectedVersion, proposal, latestRound) => {
    const { tx, repository } = transaction(proposal, latestRound)
    await expect(repository.submitForSeller({ ...input, expectedVersion })).resolves.toEqual({ kind: 'conflict' })
    expect(tx.propertyProposalReviewRound.create).not.toHaveBeenCalled()
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it.each(['round', 'update'] as const)('uses transaction rollback to retain the prior round and rejection decision when %s write fails', async (failure) => {
    const state = { proposal: structuredClone(staged), rounds: [{ ...priorRound, ...staged, id: 'round-2', roundNumber: 2, decision: { outcome: 'REJECTED', rejectionReason: 'Needs photos' } }] }
    const before = structuredClone(state)
    const prisma = { $transaction: async (callback: (tx: never) => Promise<unknown>) => {
      const draft = structuredClone(state)
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'locked' }]),
        propertyProposal: { findFirst: vi.fn().mockResolvedValue(draft.proposal), update: vi.fn(({ data }) => { if (failure === 'update') throw new Error('update failure'); draft.proposal = { ...draft.proposal, ...data, state: 'EN_REVISION', version: 8 }; return draft.proposal }) },
        propertyProposalReviewRound: { findFirst: vi.fn().mockResolvedValue(draft.rounds.at(-1)), create: vi.fn(({ data }) => { if (failure === 'round') throw new Error('round failure'); const round = { id: 'round-3', ...data }; draft.rounds.push(round); return round }) },
      }
      const result = await callback(tx as never)
      Object.assign(state, draft)
      return result
    } }

    await expect(new PrismaPropertyProposalsRepository(prisma as never).submitForSeller(input)).rejects.toThrow(`${failure} failure`)
    expect(state).toEqual(before)
  })

  it('rolls a failed next-round insert out before the proposal transition', async () => {
    const { tx, repository } = transaction()
    tx.propertyProposalReviewRound.create.mockRejectedValueOnce(new Error('round failure'))
    await expect(repository.submitForSeller(input)).rejects.toThrow('round failure')
    expect(tx.propertyProposal.update).not.toHaveBeenCalled()
  })

  it('propagates a proposal-update failure through the same outer transaction', async () => {
    const { tx, repository } = transaction()
    tx.propertyProposal.update.mockRejectedValueOnce(new Error('update failure'))
    await expect(repository.submitForSeller(input)).rejects.toThrow('update failure')
    expect(tx.propertyProposalReviewRound.create).toHaveBeenCalledOnce()
  })

  it('maps only the round-number P2002 through the repository and use case to the stable conflict', async () => {
    const { tx, repository } = transaction()
    tx.propertyProposalReviewRound.create.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002', clientVersion: '6.19.2', meta: { target: ['proposalId', 'roundNumber'] },
    }))

    await expect(new SubmitPropertyProposalUseCase(repository).execute({ tenantId: input.tenantId } as never, { id: input.proposedByUserId } as never, input.proposalId, { expectedVersion: input.expectedVersion }))
      .rejects.toEqual(expect.objectContaining({ response: { errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT', message: 'Property proposal state conflict' } }))
  })

  it('does not classify a different P2002 as a state conflict', async () => {
    const { tx, repository } = transaction()
    const error = new Prisma.PrismaClientKnownRequestError('other unique', { code: 'P2002', clientVersion: '6.19.2', meta: { target: ['tenantId', 'id'] } })
    tx.propertyProposalReviewRound.create.mockRejectedValueOnce(error)

    await expect(repository.submitForSeller(input)).rejects.toBe(error)
  })
})
