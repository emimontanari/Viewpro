import type { INestApplication } from '@nestjs/common'
import { PropertyOperationType, PropertyType, TenantRole, TenantStatus } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'
import { runCleanupSteps } from './cleanup-steps'

type TestAgent = ReturnType<typeof request.agent>
type Session = {
  agent: TestAgent
  membershipId: string
  tenantId: string
  userId: string
}

const proposalFields = {
  title: 'Agent-owned proposal',
  addressLine: 'Calle de prueba 123',
  city: 'Córdoba',
  province: 'Córdoba',
  propertyType: PropertyType.APARTMENT,
  operationType: PropertyOperationType.SALE,
  totalAreaSqm: 85,
}

const snapshotKeys = [
  'title', 'addressLine', 'city', 'province', 'propertyType', 'operationType', 'totalAreaSqm',
  'coveredAreaSqm', 'rooms', 'bedrooms', 'bathrooms', 'garages', 'ageYears', 'orientation',
  'ownerName', 'ownerEmail', 'publishedPriceCents', 'currency',
]
const detailKeys = [
  'id', 'state', 'version', ...snapshotKeys, 'latestSubmittedAt', 'createdAt', 'updatedAt',
  'history', 'currentReviewRoundId', 'canonicalEngagementId',
]
const summaryKeys = [
  'id', 'state', 'version', 'title', 'latestSubmittedAt', 'createdAt', 'updatedAt',
  'currentReviewRoundId', 'canonicalEngagementId',
]
const historyKeys = ['id', 'roundNumber', 'submittedAt', 'submittedBy', 'snapshot', 'decision']
const personKeys = ['id', 'firstName', 'lastName']
const decisionKeys = ['outcome', 'decidedAt', 'rejectionReason', 'reviewer']
const privateKeys = new Set([
  'tenantId', 'proposedByUserId', 'submittedByUserId', 'reviewerUserId', 'email', 'status',
      'sourceEngagement', 'sourceProposalId', 'tenant', 'membership', 'user', 'propertyProposal',
      'reviewRounds', 'reviewDecisions', 'assignments', 'propertyAgents', 'relation', 'rawRelation',
      'secret', 'secretKey', 'fixtureSecret',
])

describe('Property proposals seller transport (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let previousPublicErrorEnvelopeEnabled: string | undefined
  const tenantIds = new Set<string>()
  const userIds = new Set<string>()

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    previousPublicErrorEnvelopeEnabled = process.env.PUBLIC_ERROR_ENVELOPE_ENABLED
    process.env.PUBLIC_ERROR_ENVELOPE_ENABLED = 'true'
    process.env.ACCESS_TOKEN_SECRET ??= randomUUID()
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'
    app = await createApiApp()
    await app.listen(0)
    prisma = app.get(PrismaService)
  })

  afterEach(async () => {
    const tenants = [...tenantIds]
    const users = [...userIds]
    let sources: { id: string; propertyAssetId: string }[] = []
    try {
      sources = await prisma.propertyEngagement.findMany({
        where: { tenantId: { in: tenants }, sourceProposalId: { not: null } }, select: { id: true, propertyAssetId: true },
      })
      await runCleanupSteps([
        { name: 'source engagements', run: async () => { await prisma.propertyEngagement.deleteMany({ where: { id: { in: sources.map(({ id }) => id) } } }) } },
        { name: 'captured orphan assets', run: async () => { await prisma.propertyAsset.deleteMany({ where: { id: { in: sources.map(({ propertyAssetId }) => propertyAssetId) } } }) } },
        { name: 'proposal decisions', run: async () => { await prisma.propertyProposalReviewDecision.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'proposal rounds', run: async () => { await prisma.propertyProposalReviewRound.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'proposals', run: async () => { await prisma.propertyProposal.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'registration outbox events', run: async () => { await prisma.platformOutboxEvent.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'refresh tokens', run: async () => { await prisma.refreshToken.deleteMany({ where: { userId: { in: users } } }) } },
        { name: 'tenant memberships', run: async () => { await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'tenants', run: async () => { await prisma.tenant.deleteMany({ where: { id: { in: tenants } } }) } },
        { name: 'users', run: async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }) } },
      ])
      const remainingProposals = await prisma.propertyProposal.count({ where: { tenantId: { in: tenants } } })
      if (remainingProposals !== 0) throw new Error(`Proposal cleanup left ${remainingProposals} rows`)
    } finally {
      tenantIds.clear()
      userIds.clear()
    }
  })

  afterAll(async () => {
    try {
      await app.close()
    } finally {
      if (previousPublicErrorEnvelopeEnabled === undefined) delete process.env.PUBLIC_ERROR_ENVELOPE_ENABLED
      else process.env.PUBLIC_ERROR_ENVELOPE_ENABLED = previousPublicErrorEnvelopeEnabled
    }
  })

  it('lets an authenticated agent create, list, detail, update, and submit only safe proposal responses', async () => {
    const { manager, seller } = await sellerInManagedTenant()
    const created = await seller.agent
      .post('/api/property-proposals')
      .set('x-tenant-id', manager.tenantId)
      .send({ title: proposalFields.title })
      .expect(201)

    expect(created.body).toMatchObject({ title: proposalFields.title, state: 'BORRADOR', version: 1, history: [] })
    expectSafeDetail(created.body)

    const listed = await seller.agent
      .get('/api/property-proposals')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)
    expect(listed.body).toMatchObject({ total: 1, page: 1, pageSize: 20, items: [{ id: created.body.id, title: proposalFields.title }] })
    expectOnlyKeys(listed.body, ['items', 'total', 'page', 'pageSize'])
    expectOnlyKeys(listed.body.items[0], summaryKeys)
    expectNoPrivateFields(listed.body)

    const detailed = await seller.agent
      .get(`/api/property-proposals/${created.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .expect(200)
    expect(detailed.body).toMatchObject({ id: created.body.id, state: 'BORRADOR', history: [] })
    expectSafeDetail(detailed.body)

    const updated = await seller.agent
      .patch(`/api/property-proposals/${created.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .send({ ...proposalFields, expectedVersion: detailed.body.version })
      .expect(200)
    expect(updated.body).toMatchObject({ id: created.body.id, version: 2, title: proposalFields.title })
    expectSafeDetail(updated.body)

    const submitted = await seller.agent
      .post(`/api/property-proposals/${created.body.id}/submit`)
      .set('x-tenant-id', manager.tenantId)
      .send({ expectedVersion: updated.body.version })
      .expect(200)
    expect(submitted.body).toMatchObject({
      id: created.body.id,
      state: 'EN_REVISION',
      version: 3,
      currentReviewRoundId: expect.any(String),
      history: [expect.objectContaining({ roundNumber: 1, snapshot: expect.objectContaining({ title: proposalFields.title }) })],
    })
    expectSafeDetail(submitted.body)
  })

  it('rejects unknown seller body and query keys through the global whitelist', async () => {
    const { manager, seller } = await sellerInManagedTenant()
    expectPublicError(await seller.agent.post('/api/property-proposals').set('x-tenant-id', manager.tenantId)
      .send({ title: 'Unknown create key', tenantId: randomUUID() }), 400, 'REQUEST_FAILED')

    const created = await createDraft(seller, manager.tenantId)
    expectPublicError(await seller.agent.patch(`/api/property-proposals/${created.id}`).set('x-tenant-id', manager.tenantId)
      .send({ expectedVersion: created.version, membership: 'forged' }), 400, 'REQUEST_FAILED')
    expectPublicError(await seller.agent.post(`/api/property-proposals/${created.id}/submit`).set('x-tenant-id', manager.tenantId)
      .send({ expectedVersion: created.version, sourceProposalId: randomUUID() }), 400, 'REQUEST_FAILED')
    expectPublicError(await seller.agent.get('/api/property-proposals?tenantId=forged')
      .set('x-tenant-id', manager.tenantId), 400, 'REQUEST_FAILED')
  })

  it('checks seller permission before looking up a valid but absent proposal id', async () => {
    const manager = await registerTenantSession(
      `proposal-manager-permission-${randomUUID()}@example.com`,
      'Proposal Permission Homes',
    )
    expectPublicError(await manager.agent
      .get(`/api/property-proposals/${randomUUID()}`)
      .set('x-tenant-id', manager.tenantId), 403, 'REQUEST_FAILED')
  })

  it('returns the same coded 404 for absent, another-seller, and other-active-tenant reads', async () => {
    const { manager, seller } = await sellerInManagedTenant()
    const otherSeller = await registerTenantSession('proposal-other-seller@example.com', 'Other Seller Homes')
    await prisma.tenantMembership.update({ where: { id: otherSeller.membershipId }, data: { role: TenantRole.AGENT } })
    await prisma.tenantMembership.create({ data: { userId: otherSeller.userId, tenantId: manager.tenantId, role: TenantRole.AGENT } })
    const activeSecondTenant = await prisma.tenant.update({
      where: { id: seller.tenantId }, data: { status: TenantStatus.ACTIVE }, select: { id: true, status: true },
    })
    expect(activeSecondTenant).toEqual({ id: seller.tenantId, status: TenantStatus.ACTIVE })
    const proposal = await createDraft(seller, manager.tenantId)

    const responses = await Promise.all([
      seller.agent.get(`/api/property-proposals/${randomUUID()}`).set('x-tenant-id', manager.tenantId),
      otherSeller.agent.get(`/api/property-proposals/${proposal.id}`).set('x-tenant-id', manager.tenantId),
      seller.agent.get(`/api/property-proposals/${proposal.id}`).set('x-tenant-id', seller.tenantId),
    ])
    for (const response of responses) {
      expectPublicError(response, 404, 'PROPERTY_PROPOSAL_NOT_FOUND')
    }
  })

    it('uses the current persisted role on the next cookie-authenticated request and leaves absent routes unavailable', async () => {
        const { manager, seller, sellerMembershipId } = await sellerInManagedTenant()
        const proposal = await createDraft(seller, manager.tenantId)

        await manager.agent
          .patch(`/api/team/members/${sellerMembershipId}/role`)
          .set('x-tenant-id', manager.tenantId)
          .send({ role: TenantRole.MANAGER })
          .expect(200)

        expectPublicError(await seller.agent.get('/api/property-proposals')
          .set('x-tenant-id', manager.tenantId), 403, 'REQUEST_FAILED')
        expectPublicError(await seller.agent.delete(`/api/property-proposals/${proposal.id}`)
          .set('x-tenant-id', manager.tenantId), 404, 'REQUEST_FAILED')
        expectPublicError(await seller.agent.post(`/api/property-proposals/${proposal.id}/withdraw`)
          .set('x-tenant-id', manager.tenantId), 404, 'REQUEST_FAILED')
        expectPublicError(await seller.agent.post(`/api/property-proposals/${proposal.id}/images`)
          .set('x-tenant-id', manager.tenantId), 404, 'REQUEST_FAILED')
      })

      it('guards static reviewer reads, scopes them to the tenant, and never writes on GET', async () => {
        const { manager, seller } = await sellerInManagedTenant()
        await prisma.tenantMembership.update({ where: { id: manager.membershipId }, data: { role: TenantRole.MANAGER } })
        const proposal = await submitForReview(seller, manager.tenantId)
        await prisma.tenant.update({ where: { id: seller.tenantId }, data: { status: TenantStatus.ACTIVE } })
        const otherProposal = await submitForReview(seller, seller.tenantId)
        const unauthenticated = await request(app.getHttpServer()).get('/api/property-proposals/review').set('x-tenant-id', manager.tenantId)
        expect(unauthenticated.status).toBe(401)
        for (const path of [`/api/property-proposals/review/${randomUUID()}/reject`, `/api/property-proposals/review/${randomUUID()}/approve`]) {
          expectPublicError(await seller.agent.post(path).set('x-tenant-id', manager.tenantId).send({ reviewRoundId: randomUUID() }), 403, 'REQUEST_FAILED')
        }
        for (const query of ['search=forged', 'pageSize=51']) expectPublicError(await manager.agent
          .get(`/api/property-proposals/review?${query}`).set('x-tenant-id', manager.tenantId), 400, 'REQUEST_FAILED')

        const before = await reviewerReadCounts(manager.tenantId, seller.userId)
        const listed = await manager.agent.get('/api/property-proposals/review').set('x-tenant-id', manager.tenantId).expect(200)
        const detailed = await manager.agent.get(`/api/property-proposals/review/${proposal.id}`).set('x-tenant-id', manager.tenantId).expect(200)
        expect(listed.body.items).toEqual([expect.objectContaining({ id: proposal.id, proposedBy: expect.objectContaining({ id: seller.userId }) })])
        expect(listed.body.items.map(({ id }: { id: string }) => id)).not.toContain(otherProposal.id)
        expectSafeReviewerList(listed.body)
        expectSafeReviewerDetail(detailed.body)
        expect(await reviewerReadCounts(manager.tenantId, seller.userId)).toEqual(before)

        const otherManager = await registerTenantSession(`proposal-review-other-${randomUUID()}@example.com`, `Other Review ${randomUUID()}`)
        for (const response of await Promise.all([
          otherManager.agent.get(`/api/property-proposals/review/${proposal.id}`).set('x-tenant-id', otherManager.tenantId),
          manager.agent.get(`/api/property-proposals/review/${randomUUID()}`).set('x-tenant-id', manager.tenantId),
        ])) expectPublicError(response, 404, 'PROPERTY_PROPOSAL_NOT_FOUND')

        await prisma.tenantMembership.update({ where: { id: manager.membershipId }, data: { role: TenantRole.PRINCIPAL_MANAGER } })
        expectSafeReviewerList((await manager.agent.get('/api/property-proposals/review').set('x-tenant-id', manager.tenantId).expect(200)).body)
      })

      it('returns safe rereads for rejection and blocks stale rounds and durable self-review', async () => {
        const { manager, seller, sellerMembershipId } = await sellerInManagedTenant()
        const proposal = await submitForReview(seller, manager.tenantId)
        for (const reason of ['', ' ', 1, 'x'.repeat(1001)]) expectPublicError(await manager.agent
          .post(`/api/property-proposals/review/${proposal.id}/reject`).set('x-tenant-id', manager.tenantId)
          .send({ reviewRoundId: proposal.reviewRoundId, reason }), 400, 'PROPERTY_PROPOSAL_REJECTION_REASON_INVALID')
        const reason = 'x'.repeat(1000)
        const rejected = await manager.agent.post(`/api/property-proposals/review/${proposal.id}/reject`).set('x-tenant-id', manager.tenantId)
          .send({ reviewRoundId: proposal.reviewRoundId, reason }).expect(200)
        expect(rejected.body.history[0].decision).toMatchObject({ outcome: 'REJECTED', rejectionReason: reason })
        expectSafeReviewerDetail(rejected.body)
        expectSafeReviewerDetail((await manager.agent.post(`/api/property-proposals/review/${proposal.id}/reject`).set('x-tenant-id', manager.tenantId)
          .send({ reviewRoundId: proposal.reviewRoundId, reason }).expect(200)).body)
        const otherReviewer = await registerTenantSession(`proposal-reviewer-${randomUUID()}@example.com`, `Reviewer ${randomUUID()}`)
        await prisma.tenantMembership.create({ data: { userId: otherReviewer.userId, tenantId: manager.tenantId, role: TenantRole.MANAGER } })
        for (const response of await Promise.all([
          manager.agent.post(`/api/property-proposals/review/${proposal.id}/reject`).set('x-tenant-id', manager.tenantId).send({ reviewRoundId: randomUUID(), reason }),
          otherReviewer.agent.post(`/api/property-proposals/review/${proposal.id}/reject`).set('x-tenant-id', manager.tenantId).send({ reviewRoundId: proposal.reviewRoundId, reason }),
        ])) expectPublicError(response, 409, 'PROPERTY_PROPOSAL_STATE_CONFLICT')
        await manager.agent.patch(`/api/team/members/${sellerMembershipId}/role`).set('x-tenant-id', manager.tenantId)
          .send({ role: TenantRole.MANAGER }).expect(200)
        expectPublicError(await seller.agent.post(`/api/property-proposals/review/${proposal.id}/reject`).set('x-tenant-id', manager.tenantId)
          .send({ reviewRoundId: proposal.reviewRoundId, reason }), 403, 'PROPERTY_PROPOSAL_SELF_REVIEW_FORBIDDEN')
      })

      it('approves once through the mounted materializer and leaves no owner, image, or event side effects', async () => {
        const { manager, seller } = await sellerInManagedTenant()
        const proposal = await submitForReview(seller, manager.tenantId)
        const effects = await Promise.all([prisma.notification.count({ where: { tenantId: manager.tenantId } }), prisma.analyticsEvent.count({ where: { tenantId: manager.tenantId } }), prisma.platformOutboxEvent.count({ where: { tenantId: manager.tenantId } })])
        const approved = await manager.agent.post(`/api/property-proposals/review/${proposal.id}/approve`).set('x-tenant-id', manager.tenantId)
          .send({ reviewRoundId: proposal.reviewRoundId }).expect(200)
        expect(approved.body).toMatchObject({ id: proposal.id, state: 'APROBADA', canonicalEngagementId: expect.any(String) })
        expectSafeReviewerDetail(approved.body)
        const source = await prisma.propertyEngagement.findFirstOrThrow({ where: { tenantId: manager.tenantId, sourceProposalId: proposal.id }, include: { propertyAsset: true, agents: true } })
        expect(source).toMatchObject({ status: 'CAPTURE', createdByUserId: seller.userId, propertyAsset: { createdByUserId: seller.userId }, agents: [{ agentUserId: seller.userId, assignedByUserId: manager.userId, isPrimary: false }] })
        expect(approved.body.canonicalEngagementId).toBe(source.id)
        const counts = await approvedAggregateCounts(manager.tenantId, proposal.reviewRoundId, source.propertyAssetId, source.id)
        expect(counts).toEqual([1, 1, 1, 1, 0, 0, ...effects])
        const replay = await manager.agent.post(`/api/property-proposals/review/${proposal.id}/approve`).set('x-tenant-id', manager.tenantId)
          .send({ reviewRoundId: proposal.reviewRoundId }).expect(200)
        expect(replay.body.canonicalEngagementId).toBe(source.id)
        expect(await approvedAggregateCounts(manager.tenantId, proposal.reviewRoundId, source.propertyAssetId, source.id)).toEqual(counts)
        expectSafeReviewerDetail(replay.body)
      })

      async function sellerInManagedTenant() {
    const manager = await registerTenantSession(`proposal-manager-${randomUUID()}@example.com`, `Proposal Manager ${randomUUID()}`)
    const seller = await registerTenantSession(`proposal-seller-${randomUUID()}@example.com`, `Proposal Seller ${randomUUID()}`)
    await prisma.tenantMembership.update({ where: { id: seller.membershipId }, data: { role: TenantRole.AGENT } })
    const membership = await prisma.tenantMembership.create({
      data: { userId: seller.userId, tenantId: manager.tenantId, role: TenantRole.AGENT },
    })
    return { manager, seller, sellerMembershipId: membership.id }
  }

  async function registerTenantSession(email: string, tenantName: string): Promise<Session> {
    const agent = request.agent(app.getHttpServer())
    const response = await agent.post('/api/auth/register-tenant').send({
      whatsappPhone: '3510000000', email, password: 'password123', firstName: 'Seller', tenantName,
    }).expect(201)
    const session = {
      agent,
      membershipId: response.body.memberships[0].id as string,
      tenantId: response.body.memberships[0].tenant.id as string,
      userId: response.body.user.id as string,
    }
    tenantIds.add(session.tenantId)
    userIds.add(session.userId)
    return session
  }

  async function createDraft(seller: Session, tenantId: string) {
    const response = await seller.agent.post('/api/property-proposals').set('x-tenant-id', tenantId)
      .send({ title: `Draft ${randomUUID()}` }).expect(201)
    return { id: response.body.id as string, version: response.body.version as number }
  }

  async function submitForReview(seller: Session, tenantId: string) {
    const draft = await createDraft(seller, tenantId)
    const updated = await seller.agent.patch(`/api/property-proposals/${draft.id}`).set('x-tenant-id', tenantId)
      .send({ ...proposalFields, expectedVersion: draft.version }).expect(200)
    const submitted = await seller.agent.post(`/api/property-proposals/${draft.id}/submit`).set('x-tenant-id', tenantId)
      .send({ expectedVersion: updated.body.version }).expect(200)
    return { id: draft.id, reviewRoundId: submitted.body.currentReviewRoundId as string }
  }

  function reviewerReadCounts(tenantId: string, userId: string) {
    return Promise.all([
      prisma.propertyProposal.count({ where: { tenantId } }), prisma.propertyProposalReviewRound.count({ where: { tenantId } }),
      prisma.propertyProposalReviewDecision.count({ where: { tenantId } }), prisma.propertyEngagement.count({ where: { tenantId } }),
      prisma.propertyAgent.count({ where: { tenantId } }), prisma.propertyAsset.count({ where: { createdByUserId: userId } }),
      prisma.notification.count({ where: { tenantId } }), prisma.analyticsEvent.count({ where: { tenantId } }), prisma.platformOutboxEvent.count({ where: { tenantId } }),
    ])
  }

  function approvedAggregateCounts(tenantId: string, reviewRoundId: string, propertyAssetId: string, engagementId: string) {
    return Promise.all([
      prisma.propertyAsset.count({ where: { id: propertyAssetId } }), prisma.propertyEngagement.count({ where: { id: engagementId, tenantId } }),
      prisma.propertyProposalReviewDecision.count({ where: { tenantId, reviewRoundId } }), prisma.propertyAgent.count({ where: { tenantId, propertyEngagementId: engagementId } }),
      prisma.propertyAssetOwner.count({ where: { propertyAssetId } }), prisma.propertyAssetImage.count({ where: { propertyAssetId } }),
      prisma.notification.count({ where: { tenantId } }), prisma.analyticsEvent.count({ where: { tenantId } }), prisma.platformOutboxEvent.count({ where: { tenantId } }),
    ])
  }
})

function expectSafeDetail(response: Record<string, unknown>) {
  expectOnlyKeys(response, detailKeys)
  expect(Array.isArray(response.history)).toBe(true)
  expectSafeHistory(response.history as unknown[])
  expectNoPrivateFields(response)
}

function expectSafeReviewerList(response: Record<string, unknown>) {
  expectOnlyKeys(response, ['items', 'total', 'page', 'pageSize'])
      for (const item of response.items as unknown[]) {
        expectOnlyKeys(item, [...summaryKeys, 'proposedBy'])
        expectOnlyKeys((item as Record<string, unknown>).proposedBy, personKeys)
      }
      expectNoPrivateFields(response)
}

function expectSafeReviewerDetail(response: Record<string, unknown>) {
  expectOnlyKeys(response, [...detailKeys, 'proposedBy'])
  expectOnlyKeys(response.proposedBy, personKeys)
  expectSafeHistory(response.history as unknown[])
  expectNoPrivateFields(response)
}

function expectSafeHistory(history: unknown[]) {
  for (const round of history) {
    expectOnlyKeys(round, historyKeys)
    const record = round as Record<string, unknown>
    expectOnlyKeys(record.snapshot, snapshotKeys)
    expectOnlyKeys(record.submittedBy, personKeys)
    if (record.decision !== null) {
      expectOnlyKeys(record.decision, decisionKeys)
      expectOnlyKeys((record.decision as Record<string, unknown>).reviewer, personKeys)
    }
  }
}

function expectOnlyKeys(value: unknown, allowed: readonly string[]) {
  expect(value).not.toBeNull()
  expect(typeof value).toBe('object')
  expect(Array.isArray(value)).toBe(false)
  expect(Object.keys(value as Record<string, unknown>).every((key) => allowed.includes(key))).toBe(true)
}

function expectNoPrivateFields(value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) expectNoPrivateFields(item)
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    expect(privateKeys.has(key)).toBe(false)
    expectNoPrivateFields(child)
  }
}

function expectPublicError(response: { status: number; body: unknown }, statusCode: number, errorCode: string) {
  expect(response.status).toBe(statusCode)
  expect(response.body).toEqual({ statusCode, errorCode, requestId: expect.any(String) })
}
