import { TenantRole, TenantStatus } from '@prisma/client'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Tenant context and permissions (e2e)', () => {
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
    await prisma.refreshToken.deleteMany()
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await app.close()
  })

  it('/me includes role-derived permissions per membership', async () => {
    const { agent } = await registerTenantSession('permissions-owner@example.com', 'Permissions Homes')

    const response = await agent.get('/api/auth/me').expect(200)

    expect(response.body.memberships[0]).toMatchObject({
      role: TenantRole.PRINCIPAL_MANAGER,
      permissions: expect.arrayContaining(['tenant.view', 'tenant.manage_settings']),
    })
  })

  it('rejects protected tenant endpoint without x-tenant-id', async () => {
    const { agent } = await registerTenantSession('missing-tenant@example.com', 'Missing Tenant Homes')

    const response = await agent.get('/api/tenant-context/demo/view').expect(403)

    expect(response.body.message).toBe('Tenant context required')
  })

  it('rejects tenant id where the user has no membership', async () => {
    const { agent } = await registerTenantSession('primary@example.com', 'Primary Homes')
    const other = await registerTenantSession('other@example.com', 'Other Homes')

    const response = await agent.get('/api/tenant-context/demo/view').set('x-tenant-id', other.tenantId).expect(403)

    expect(response.body.message).toBe('Tenant access denied')
  })

  it('attaches tenant context for a valid membership', async () => {
    const { agent, tenantId } = await registerTenantSession('valid-tenant@example.com', 'Valid Tenant Homes')

    const response = await agent.get('/api/tenant-context/demo/view').set('x-tenant-id', tenantId).expect(200)

    expect(response.body.tenant).toMatchObject({
      tenantId,
      tenantSlug: 'valid-tenant-homes',
      tenantStatus: TenantStatus.TRIAL,
      role: TenantRole.PRINCIPAL_MANAGER,
      permissions: expect.arrayContaining(['tenant.view']),
      userStatus: 'ACTIVE',
    })
  })

  it('allows an agent to access tenant.view but not tenant.manage_settings', async () => {
    const { agent, tenantId, userId } = await registerTenantSession('agent@example.com', 'Agent Homes')
    await prisma.tenantMembership.update({
      where: { userId_tenantId: { userId, tenantId } },
      data: { role: TenantRole.AGENT },
    })

    await agent.get('/api/tenant-context/demo/view').set('x-tenant-id', tenantId).expect(200)

    const response = await agent.get('/api/tenant-context/demo/manage-settings').set('x-tenant-id', tenantId).expect(403)

    expect(response.body.message).toBe('Insufficient permissions')
  })

  it('allows a principal manager to access tenant.manage_settings', async () => {
    const { agent, tenantId } = await registerTenantSession('principal@example.com', 'Principal Homes')

    await agent.get('/api/tenant-context/demo/manage-settings').set('x-tenant-id', tenantId).expect(200)
  })

  it('rejects access for suspended and cancelled tenants', async () => {
    const suspended = await registerTenantSession('suspended@example.com', 'Suspended Homes')
    await prisma.tenant.update({ where: { id: suspended.tenantId }, data: { status: TenantStatus.SUSPENDED } })

    const suspendedResponse = await suspended.agent
      .get('/api/tenant-context/demo/view')
      .set('x-tenant-id', suspended.tenantId)
      .expect(403)
    expect(suspendedResponse.body.message).toBe('Tenant is not active')

    const cancelled = await registerTenantSession('cancelled@example.com', 'Cancelled Homes')
    await prisma.tenant.update({ where: { id: cancelled.tenantId }, data: { status: TenantStatus.CANCELLED } })

    const cancelledResponse = await cancelled.agent
      .get('/api/tenant-context/demo/view')
      .set('x-tenant-id', cancelled.tenantId)
      .expect(403)
    expect(cancelledResponse.body.message).toBe('Tenant is not active')
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
})
