import { MovementType, PropertyEngagementStatus, PropertyOperationType, PropertyType, TenantRole } from '@prisma/client'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Movements (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.movement.deleteMany()
    await prisma.propertyAgent.deleteMany()
    await prisma.propertyEngagement.deleteMany()
    await prisma.propertyAsset.deleteMany()
    await prisma.refreshToken.deleteMany()
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await app.close()
  })

  it('allows a manager to create a movement on a tenant engagement', async () => {
    const manager = await registerTenantSession('manager-movement-create@example.com', 'Manager Movement Homes')
    const engagement = await createEngagement(manager.agent, manager.tenantId, { title: 'Manager Movement Property' }).expect(201)

    const response = await createMovement(manager.agent, manager.tenantId, engagement.body.id, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Listing photos were refreshed.',
      nextStep: 'Review new inquiries tomorrow',
    }).expect(201)

    expect(response.body).toMatchObject({
      tenantId: manager.tenantId,
      propertyEngagementId: engagement.body.id,
      type: MovementType.GENERAL_UPDATE,
      observation: 'Listing photos were refreshed.',
      nextStep: 'Review new inquiries tomorrow',
      previousStatus: null,
      newStatus: null,
      createdBy: {
        id: manager.userId,
        email: 'manager-movement-create@example.com',
        firstName: 'Owner',
      },
    })
    await expect(prisma.movement.count({ where: { tenantId: manager.tenantId } })).resolves.toBe(1)
  })

  it('allows an agent to create a movement only on an assigned engagement', async () => {
    const manager = await registerTenantSession('manager-agent-movement@example.com', 'Agent Movement Homes')
    const agent = await registerTenantSession('agent-movement-assigned@example.com', 'Agent Assigned Movement Homes')
    await addTenantAgent(agent.userId, manager.tenantId)
    const engagement = await createEngagement(manager.agent, manager.tenantId, { title: 'Assigned Movement Property' }).expect(201)
    await assignAgent(manager.agent, manager.tenantId, engagement.body.id, agent.userId).expect(201)

    const response = await createMovement(agent.agent, manager.tenantId, engagement.body.id, {
      type: MovementType.INQUIRY,
      observation: 'Buyer asked for a Saturday visit.',
    }).expect(201)

    expect(response.body).toMatchObject({
      tenantId: manager.tenantId,
      propertyEngagementId: engagement.body.id,
      type: MovementType.INQUIRY,
      observation: 'Buyer asked for a Saturday visit.',
      createdBy: { id: agent.userId, email: 'agent-movement-assigned@example.com' },
    })
  })

  it('returns 404 when an agent creates a movement on an unassigned engagement', async () => {
    const manager = await registerTenantSession('manager-agent-unassigned@example.com', 'Agent Unassigned Homes')
    const agent = await registerTenantSession('agent-movement-unassigned@example.com', 'Agent Unassigned Movement Homes')
    await addTenantAgent(agent.userId, manager.tenantId)
    const engagement = await createEngagement(manager.agent, manager.tenantId, { title: 'Unassigned Movement Property' }).expect(201)

    const response = await createMovement(agent.agent, manager.tenantId, engagement.body.id, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Should not reveal unassigned engagement.',
    }).expect(404)

    expect(response.body.message).toBe('Property engagement not found')
    await expect(prisma.movement.count()).resolves.toBe(0)
  })

  it('updates engagement status when a movement provides newStatus', async () => {
    const manager = await registerTenantSession('manager-status-movement@example.com', 'Status Movement Homes')
    const engagement = await createEngagement(manager.agent, manager.tenantId, {
      title: 'Status Movement Property',
    }).expect(201)
    await prisma.propertyEngagement.update({
      where: { id: engagement.body.id },
      data: { status: PropertyEngagementStatus.ACTIVE_PUBLICATION },
    })

    const response = await createMovement(manager.agent, manager.tenantId, engagement.body.id, {
      type: MovementType.STATUS_CHANGE,
      observation: 'First qualified inquiry received.',
      newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
    }).expect(201)

    expect(response.body).toMatchObject({
      previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
    })
    await expect(
      prisma.propertyEngagement.findUnique({ where: { id: engagement.body.id }, select: { status: true } }),
    ).resolves.toEqual({ status: PropertyEngagementStatus.INQUIRIES_AND_VISITS })
  })

  it('returns timeline movements for the requested tenant engagement only', async () => {
    const manager = await registerTenantSession('manager-timeline@example.com', 'Timeline Homes')
    const firstEngagement = await createEngagement(manager.agent, manager.tenantId, { title: 'Timeline Property' }).expect(201)
    const otherEngagement = await createEngagement(manager.agent, manager.tenantId, { title: 'Other Timeline Property' }).expect(201)
    const firstMovement = await createMovement(manager.agent, manager.tenantId, firstEngagement.body.id, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Publication went live.',
    }).expect(201)
    await createMovement(manager.agent, manager.tenantId, otherEngagement.body.id, {
      type: MovementType.INQUIRY,
      observation: 'Other engagement inquiry.',
    }).expect(201)

    const response = await manager.agent
      .get(`/api/property-engagements/${firstEngagement.body.id}/movements?page=1&pageSize=10&order=asc`)
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 10 })
    expect(response.body.items).toHaveLength(1)
    expect(response.body.items[0]).toMatchObject({
      id: firstMovement.body.id,
      propertyEngagementId: firstEngagement.body.id,
      observation: 'Publication went live.',
    })
  })

  it('returns 404 when Tenant A reads Tenant B movement timeline', async () => {
    const tenantA = await registerTenantSession('tenant-a-movement-read@example.com', 'Tenant A Movement Homes')
    const tenantB = await registerTenantSession('tenant-b-movement-read@example.com', 'Tenant B Movement Homes')
    const tenantBEngagement = await createEngagement(tenantB.agent, tenantB.tenantId, { title: 'Tenant B Movement Property' }).expect(201)
    await createMovement(tenantB.agent, tenantB.tenantId, tenantBEngagement.body.id, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Tenant B private movement.',
    }).expect(201)

    const response = await tenantA.agent
      .get(`/api/property-engagements/${tenantBEngagement.body.id}/movements`)
      .set('x-tenant-id', tenantA.tenantId)
      .expect(404)

    expect(response.body.message).toBe('Property engagement not found')
  })

  it('rejects movement endpoints without x-tenant-id', async () => {
    const manager = await registerTenantSession('manager-movement-no-tenant@example.com', 'No Tenant Movement Homes')
    const engagement = await createEngagement(manager.agent, manager.tenantId, { title: 'No Tenant Movement Property' }).expect(201)

    const response = await manager.agent
      .get(`/api/property-engagements/${engagement.body.id}/movements`)
      .expect(403)

    expect(response.body.message).toBe('Tenant context required')
  })

  it('rejects empty movement observations', async () => {
    const manager = await registerTenantSession('manager-empty-observation@example.com', 'Empty Observation Homes')
    const engagement = await createEngagement(manager.agent, manager.tenantId, { title: 'Empty Observation Property' }).expect(201)

    const response = await createMovement(manager.agent, manager.tenantId, engagement.body.id, {
      type: MovementType.GENERAL_UPDATE,
      observation: '',
    }).expect(400)

    expect(response.body.message).toContain('observation should not be empty')
  })

  async function registerTenantSession(email: string, tenantName: string) {
    const agent = request.agent(app.getHttpServer())
    const response = await agent
      .post('/api/auth/register-tenant')
      .send({
        email,
        password: 'password123',
        firstName: 'Owner',
        tenantName,
      })
      .expect(201)

    return {
      agent,
      userId: response.body.user.id as string,
      tenantId: response.body.memberships[0].tenant.id as string,
    }
  }

  function createEngagement(
    agent: request.SuperAgentTest,
    tenantId: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return agent
      .post('/api/property-engagements')
      .set('x-tenant-id', tenantId)
      .send({
        title: 'Default Movement Property',
        addressLine: 'Movement Street 123',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.HOUSE,
        operationType: PropertyOperationType.SALE,
        ...overrides,
      })
  }

  function createMovement(
    agent: request.SuperAgentTest,
    tenantId: string,
    engagementId: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return agent
      .post(`/api/property-engagements/${engagementId}/movements`)
      .set('x-tenant-id', tenantId)
      .send({
        type: MovementType.GENERAL_UPDATE,
        observation: 'Default movement observation.',
        ...overrides,
      })
  }

  function assignAgent(agent: request.SuperAgentTest, tenantId: string, engagementId: string, agentUserId: string) {
    return agent.post(`/api/property-engagements/${engagementId}/agents`).set('x-tenant-id', tenantId).send({ agentUserId })
  }

  async function addTenantAgent(userId: string, tenantId: string) {
    return prisma.tenantMembership.create({
      data: {
        userId,
        tenantId,
        role: TenantRole.AGENT,
      },
    })
  }
})
