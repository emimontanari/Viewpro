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
import {
  buildReviewerSqlPredicate, buildReviewerWhere, normalizeReviewerRead,
  type PropertyProposalReviewFilters,
} from './review-filter-builder'
import { mapPropertyProposalResultLink, resolveCanonicalEngagementId } from './responses/property-proposal.response'
import { PrismaService } from '../database/prisma.service'
import type {
  CreatePropertyProposalDraftInput,
  CreatePropertyProposalResult,
  PropertyProposalsRepository,
  UpdatePropertyProposalInput,
  UpdatePropertyProposalResult,
  ReviewerPropertyProposalsPage,
  SellerPropertyProposalsPage,
  SellerPropertyProposalDetail,
  SellerPropertyProposalSummariesPage,
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

  async listSummariesForSeller(input: {
    tenantId: string
    proposedByUserId: string
    page: number
    pageSize: number
  }): Promise<SellerPropertyProposalSummariesPage> {
    const page = await this.listForSeller(input)
    const proposalIds = page.items.map(({ id }) => id)
    if (proposalIds.length === 0) return { items: [], total: page.total }

    const [viewer, rounds, engagements] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.proposedByUserId },
        select: {
          id: true,
          status: true,
          memberships: {
            where: { tenantId: input.tenantId },
            select: { userId: true, tenantId: true, status: true, role: true },
          },
        },
      }),
      this.prisma.propertyProposalReviewRound.findMany({
        where: { tenantId: input.tenantId, proposalId: { in: proposalIds } },
        orderBy: [{ proposalId: 'asc' }, { roundNumber: 'desc' }],
        select: { id: true, proposalId: true },
      }),
      this.prisma.propertyEngagement.findMany({
        where: { tenantId: input.tenantId, sourceProposalId: { in: proposalIds } },
        select: { id: true, tenantId: true, sourceProposalId: true },
      }),
    ])
    const assignments = await this.prisma.propertyAgent.findMany({
      where: {
        tenantId: input.tenantId,
        agentUserId: input.proposedByUserId,
        propertyEngagementId: { in: engagements.map(({ id }) => id) },
      },
      select: { tenantId: true, propertyEngagementId: true, agentUserId: true },
    })
    const roundByProposalId = new Map<string, string>()
    for (const round of rounds) {
      if (!roundByProposalId.has(round.proposalId)) roundByProposalId.set(round.proposalId, round.id)
    }
    const engagementByProposalId = new Map<string, { id: string; tenantId: string; sourceProposalId: string }>()
    for (const engagement of engagements) {
      if (engagement.sourceProposalId) engagementByProposalId.set(engagement.sourceProposalId, engagement as typeof engagement & { sourceProposalId: string })
    }
    const membership = viewer?.memberships[0]
    const visibilityAssignments = assignments.map((assignment) => ({
      tenantId: assignment.tenantId,
      engagementId: assignment.propertyEngagementId,
      agentUserId: assignment.agentUserId,
    }))

    return {
      total: page.total,
      items: page.items.map((proposal) => ({
        proposal,
        currentReviewRoundId: roundByProposalId.get(proposal.id),
        resultLink: mapPropertyProposalResultLink(resolveCanonicalEngagementId({
          proposal,
          canonicalEngagement: engagementByProposalId.get(proposal.id),
          viewer: viewer ?? undefined,
          membership,
          assignments: visibilityAssignments,
        })),
      })),
    }
  }

  async findForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }) {
    return this.prisma.propertyProposal.findFirst({
      where: { id: input.proposalId, tenantId: input.tenantId, proposedByUserId: input.proposedByUserId },
    })
  }

  async findDetailForSeller(input: {
    tenantId: string
    proposedByUserId: string
    proposalId: string
  }): Promise<SellerPropertyProposalDetail | null> {
    const proposal = await this.findForSeller(input)
    if (!proposal) return null
    const [rounds, viewer, engagements] = await Promise.all([
      this.prisma.propertyProposalReviewRound.findMany({
        where: { tenantId: input.tenantId, proposalId: proposal.id },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.user.findUnique({
        where: { id: input.proposedByUserId },
        select: { id: true, status: true, memberships: { where: { tenantId: input.tenantId }, select: { userId: true, tenantId: true, status: true, role: true } } },
      }),
      this.prisma.propertyEngagement.findMany({
        where: { tenantId: input.tenantId, sourceProposalId: proposal.id },
        select: { id: true, tenantId: true, sourceProposalId: true },
      }),
    ])
    const [decisions, assignments] = await Promise.all([
      this.prisma.propertyProposalReviewDecision.findMany({
        where: { tenantId: input.tenantId, reviewRoundId: { in: rounds.map(({ id }) => id) } },
      }),
      this.prisma.propertyAgent.findMany({
        where: { tenantId: input.tenantId, agentUserId: input.proposedByUserId, propertyEngagementId: { in: engagements.map(({ id }) => id) } },
        select: { tenantId: true, propertyEngagementId: true, agentUserId: true },
      }),
    ])
    const people = await this.prisma.user.findMany({
      where: {
        id: { in: [...new Set([...rounds.map(({ submittedByUserId }) => submittedByUserId), ...decisions.map(({ reviewerUserId }) => reviewerUserId)])] },
        memberships: { some: { tenantId: input.tenantId } },
      },
      select: { id: true, firstName: true, lastName: true },
    })
    const decisionByRoundId = new Map(decisions.map((decision) => [decision.reviewRoundId, decision]))
    const personById = new Map(people.map((person) => [person.id, person]))
    const history = rounds.map((round) => {
      const decision = decisionByRoundId.get(round.id)
      const submittedBy = personById.get(round.submittedByUserId)
      const reviewer = decision && personById.get(decision.reviewerUserId)
      if (!submittedBy || (decision && !reviewer)) throw new Error('proposal history actor is missing')
      return {
        id: round.id, roundNumber: round.roundNumber, submittedAt: round.submittedAt,
        submittedBy: { id: submittedBy.id, firstName: submittedBy.firstName, lastName: submittedBy.lastName },
        snapshot: mapPropertyProposalSnapshot(round),
        decision: decision && reviewer ? {
          outcome: decision.outcome, decidedAt: decision.decidedAt, rejectionReason: decision.rejectionReason,
          reviewer: { id: reviewer.id, firstName: reviewer.firstName, lastName: reviewer.lastName },
        } : null,
      }
    })
    const engagement = engagements[0]
    const membership = viewer?.memberships[0]
    return {
      proposal,
      currentReviewRoundId: rounds[0]?.id,
      history,
      resultLink: mapPropertyProposalResultLink(resolveCanonicalEngagementId({
        proposal,
        canonicalEngagement: engagement?.sourceProposalId
          ? { id: engagement.id, tenantId: engagement.tenantId, sourceProposalId: engagement.sourceProposalId }
          : undefined,
        viewer: viewer ?? undefined,
        membership,
        assignments: assignments.map(({ tenantId, propertyEngagementId, agentUserId }) => ({ tenantId, engagementId: propertyEngagementId, agentUserId })),
      })),
    }
  }

  async listForReviewer(input: {
    tenantId: string
    filters: PropertyProposalReviewFilters
  }): Promise<ReviewerPropertyProposalsPage> {
    const normalized = normalizeReviewerRead(input.filters)
    const where = buildReviewerWhere(input.tenantId, normalized)
    const [ids, total] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id
        FROM "property_proposals" p
        WHERE p."tenantId" = ${input.tenantId}
          ${buildReviewerSqlPredicate(normalized)}
        ORDER BY COALESCE(p."latestSubmittedAt", p."createdAt") DESC, p.id DESC
        OFFSET ${normalized.skip} LIMIT ${normalized.pageSize}
      `),
      this.prisma.propertyProposal.count({ where }),
    ])
    if (ids.length === 0) return { items: [], total }

    const proposals = await this.prisma.propertyProposal.findMany({
      where: { tenantId: input.tenantId, id: { in: ids.map(({ id }) => id) } },
    })
    const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]))
    return { items: ids.flatMap(({ id }) => byId.get(id) ?? []), total }
  }

  findForReviewer(input: { tenantId: string; proposalId: string }) {
    return this.prisma.propertyProposal.findFirst({
      where: { id: input.proposalId, tenantId: input.tenantId },
    })
  }
}
