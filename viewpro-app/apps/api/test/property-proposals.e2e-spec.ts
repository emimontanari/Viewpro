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
  'tenantId', 'proposedBy', 'proposedByUserId', 'submittedByUserId', 'reviewerUserId',
  'sourceEngagement', 'sourceProposalId', 'tenant', 'membership', 'user', 'propertyProposal',
  'reviewRounds', 'reviewDecisions', 'assignments', 'propertyAgents', 'relation', 'rawRelation',
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
    try {
      await runCleanupSteps([
        { name: 'proposal decisions', run: async () => { await prisma.propertyProposalReviewDecision.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'proposal rounds', run: async () => { await prisma.propertyProposalReviewRound.deleteMany({ where: { tenantId: { in: tenants } } }) } },
        { name: 'proposals', run: async () => { await prisma.propertyProposal.deleteMany({ where: { tenantId: { in: tenants } } }) } },
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
})

function expectSafeDetail(response: Record<string, unknown>) {
  expectOnlyKeys(response, detailKeys)
  expect(Array.isArray(response.history)).toBe(true)
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
