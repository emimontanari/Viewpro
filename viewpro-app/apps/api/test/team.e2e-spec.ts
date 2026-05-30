import { TenantRole } from '@prisma/client'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

type TestAgent = ReturnType<typeof request.agent>

describe('Team members (e2e)', () => {
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
    await prisma.ownerInvitation.deleteMany()
    await prisma.propertyAssetOwner.deleteMany()
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

  it('lists only members for the selected tenant without sensitive user fields', async () => {
    const manager = await registerTenantSession('team-manager@example.com', 'Team Manager Homes')
    const second = await registerTenantSession('team-second@example.com', 'Team Second Homes')
    const otherTenant = await registerTenantSession('team-other@example.com', 'Other Tenant Homes')

    const secondMembership = await prisma.tenantMembership.create({
      data: {
        user: { connect: { id: second.userId } },
        tenant: { connect: { id: manager.tenantId } },
        role: TenantRole.MANAGER,
      },
    })

    const response = await manager.agent.get('/api/team/members').set('x-tenant-id', manager.tenantId).expect(200)

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          membershipId: manager.membershipId,
          userId: manager.userId,
          email: 'team-manager@example.com',
          firstName: 'Owner',
          lastName: null,
          userStatus: 'ACTIVE',
          role: TenantRole.PRINCIPAL_MANAGER,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
        expect.objectContaining({
          membershipId: secondMembership.id,
          userId: second.userId,
          email: 'team-second@example.com',
          firstName: 'Owner',
          lastName: null,
          userStatus: 'ACTIVE',
          role: TenantRole.MANAGER,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        }),
      ]),
    )

    expect(response.body.items.map((item: { userId: string }) => item.userId)).not.toContain(otherTenant.userId)
    expect(JSON.stringify(response.body)).not.toContain('passwordHash')
    expect(JSON.stringify(response.body)).not.toContain('globalRole')
  })

  it('rejects requests without tenant context', async () => {
    const manager = await registerTenantSession('team-missing-tenant@example.com', 'Missing Team Homes')

    const response = await manager.agent.get('/api/team/members').expect(403)

    expect(response.body.message).toBe('Tenant context required')
  })

  it('rejects tenant agents without TEAM_VIEW', async () => {
    const manager = await registerTenantSession('team-owner@example.com', 'Team Owner Homes')
    const agent = await registerTenantSession('team-agent@example.com', 'Team Agent Homes')

    await prisma.tenantMembership.create({
      data: {
        user: { connect: { id: agent.userId } },
        tenant: { connect: { id: manager.tenantId } },
        role: TenantRole.AGENT,
      },
    })

    const response = await agent.agent.get('/api/team/members').set('x-tenant-id', manager.tenantId).expect(403)

    expect(response.body.message).toBe('Insufficient permissions')
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
      agent: agent as TestAgent,
      userId: response.body.user.id as string,
      tenantId: response.body.memberships[0].tenant.id as string,
      membershipId: response.body.memberships[0].id as string,
    }
  }
})
