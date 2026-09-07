import { Prisma } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import type { StagedPropertyScalarsInput } from './domain/normalization'
import { STAGED_PROPERTY_SCALAR_KEYS } from './domain/normalization'
import {
  buildSubmitReplayIdentity, buildUpdateReplayIdentity, matchesSubmitReplayIdentity, matchesUpdateReplayIdentity,
} from './domain/replay-identity'
import { assertEditableProposalState } from './domain/state-machine'
import { assertSubmissionFields } from './domain/normalization'
import { lockEligibleSeller } from './helpers/lock-property-proposal'
import { mapPropertyProposalSnapshot } from './helpers/map-property-proposal'
import { PrismaService } from '../database/prisma.service'
import type {
  CreatePropertyProposalDraftInput,
  CreatePropertyProposalResult,
  PropertyProposalsRepository,
  UpdatePropertyProposalInput,
  UpdatePropertyProposalResult,
  SellerPropertyProposalsPage,
  SubmitPropertyProposalInput,
  SubmitPropertyProposalResult,
} from './property-proposals.repository'

function isRoundNumberUniquenessError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false
  const meta = error.meta as { constraint?: unknown; target?: unknown } | undefined
  const target = meta?.target
  return meta?.constraint === 'property_proposal_review_rounds_proposalId_roundNumber_key'
    || target === 'property_proposal_review_rounds_proposalId_roundNumber_key'
    || (Array.isArray(target) && target.length === 2 && target.includes('proposalId') && target.includes('roundNumber'))
}

@Injectable()
export class PrismaPropertyProposalsRepository implements PropertyProposalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreatePropertyProposalDraftInput): Promise<CreatePropertyProposalResult> {
    return this.prisma.$transaction(async (tx) => {
      if (!await lockEligibleSeller(tx, { ...input, operation: 'create' })) return { kind: 'ineligible' }

      const proposal = await tx.propertyProposal.create({
        data: { ...input, state: 'BORRADOR', version: 1, latestSubmittedAt: null },
      })
      return { kind: 'created', proposal }
    })
  }

  async submitForSeller(input: SubmitPropertyProposalInput): Promise<SubmitPropertyProposalResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM property_proposals
        WHERE id = ${input.proposalId} AND "tenantId" = ${input.tenantId}
          AND "proposedByUserId" = ${input.proposedByUserId}
        FOR UPDATE
      `
      if (locked.length === 0) return { kind: 'notFound' }

      const proposal = await tx.propertyProposal.findFirst({
        where: { id: input.proposalId, tenantId: input.tenantId, proposedByUserId: input.proposedByUserId },
      })
      if (!proposal) return { kind: 'notFound' }
          if (!await lockEligibleSeller(tx, { ...input, operation: 'submit' })) return { kind: 'ineligible' }

          const snapshot = mapPropertyProposalSnapshot(proposal)
          if (proposal.state === 'EN_REVISION') {
            if (proposal.version !== input.expectedVersion + 1) return { kind: 'conflict' }
            const round = await tx.propertyProposalReviewRound.findFirst({
              where: { proposalId: proposal.id, tenantId: input.tenantId }, orderBy: { roundNumber: 'desc' },
            })
            if (round && matchesSubmitReplayIdentity(
                buildSubmitReplayIdentity(input.expectedVersion, round),
                buildSubmitReplayIdentity(input.expectedVersion, snapshot),
              )) return { kind: 'submitted', proposal, round }
            return { kind: 'conflict' }
          }
          if (proposal.state !== 'BORRADOR' && proposal.state !== 'RECHAZADA') return { kind: 'conflict' }
          if (proposal.version !== input.expectedVersion) return { kind: 'conflict' }

          try {
            assertSubmissionFields(snapshot)
          } catch {
            return { kind: 'incomplete' }
          }
          const latestRound = proposal.state === 'RECHAZADA'
            ? await tx.propertyProposalReviewRound.findFirst({
              where: { proposalId: proposal.id, tenantId: input.tenantId }, orderBy: { roundNumber: 'desc' },
            })
            : null
          if (proposal.state === 'RECHAZADA' && !latestRound) return { kind: 'conflict' }

          const submittedAt = new Date()
          const completeSnapshot = snapshot as typeof snapshot & { title: string }
          const round = await tx.propertyProposalReviewRound.create({
            data: { ...completeSnapshot, tenantId: input.tenantId, proposalId: proposal.id,
              roundNumber: latestRound ? latestRound.roundNumber + 1 : 1, submittedByUserId: input.proposedByUserId, submittedAt },
          })
          const updated = await tx.propertyProposal.update({
            where: { id: proposal.id },
            data: { state: 'EN_REVISION', latestSubmittedAt: submittedAt, version: { increment: 1 } },
          })
          return { kind: 'submitted', proposal: updated, round }
      })
    } catch (error) {
      if (isRoundNumberUniquenessError(error)) return { kind: 'conflict' }
      throw error
    }
  }

  async updateForSeller(input: UpdatePropertyProposalInput): Promise<UpdatePropertyProposalResult> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM property_proposals
        WHERE id = ${input.proposalId} AND "tenantId" = ${input.tenantId}
          AND "proposedByUserId" = ${input.proposedByUserId}
        FOR UPDATE
      `
      if (locked.length === 0) return { kind: 'notFound' }

      const proposal = await tx.propertyProposal.findFirst({
        where: { id: input.proposalId, tenantId: input.tenantId, proposedByUserId: input.proposedByUserId },
      })
      if (!proposal) return { kind: 'notFound' }
      if (!await lockEligibleSeller(tx, { ...input, operation: 'update' })) return { kind: 'ineligible' }
      try {
        assertEditableProposalState(proposal.state)
      } catch {
        return { kind: 'conflict' }
      }

      const replay = buildUpdateReplayIdentity(input.expectedVersion, input.patch)
      const currentPatch = Object.fromEntries(STAGED_PROPERTY_SCALAR_KEYS
        .filter((field) => Object.hasOwn(replay.patch, field))
        .map((field) => [field, proposal[field]])) as Partial<StagedPropertyScalarsInput>
      if (proposal.version === input.expectedVersion + 1
        && matchesUpdateReplayIdentity(buildUpdateReplayIdentity(input.expectedVersion, currentPatch), replay)) {
        return { kind: 'replayed', proposal }
      }
      if (proposal.version !== input.expectedVersion) return { kind: 'conflict' }

      const patch = replay.patch
      const merged = { ...proposal, ...patch }
      if (typeof merged.title !== 'string' || !merged.title.trim()) return { kind: 'conflict' }
      const updated = await tx.propertyProposal.update({
        where: { id: proposal.id }, data: { ...patch, title: merged.title, version: { increment: 1 } },
      })
      return { kind: 'updated', proposal: updated }
    })
  }

  async listForSeller(input: {
    tenantId: string
    proposedByUserId: string
    page: number
    pageSize: number
  }): Promise<SellerPropertyProposalsPage> {
    const where = { tenantId: input.tenantId, proposedByUserId: input.proposedByUserId }
    const [items, total] = await Promise.all([
      this.prisma.propertyProposal.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.propertyProposal.count({ where }),
    ])
    return { items, total }
  }

  findForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }) {
    return this.prisma.propertyProposal.findFirst({
      where: {
        id: input.proposalId,
        tenantId: input.tenantId,
        proposedByUserId: input.proposedByUserId,
      },
    })
  }
}
