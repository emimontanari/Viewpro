import type { INestApplication } from '@nestjs/common'
import { GlobalRole, TenantRole } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Admin access (e2e)', () => {
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
    await prisma.analyticsEvent.deleteMany()
    await prisma.documentVersion.deleteMany()
    await prisma.document.deleteMany()
    await prisma.documentRequest.deleteMany()
    await prisma.propertyAssetOwner.deleteMany()
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

  it('rejects unauthenticated admin access with 401', async () => {
    const response = await request(app.getHttpServer()).get('/api/admin/access-check').expect(401)

    expect(response.body.message).toBe('Authentication required')
  })

  it.each([TenantRole.PRINCIPAL_MANAGER, TenantRole.MANAGER, TenantRole.AGENT])(
    'rejects USER with %s tenant membership with 403',
    async (role) => {
      const { agent, tenantId, userId } = await registerTenantSession(`${role.toLowerCase()}@example.com`, `${role} Homes`)
      await prisma.tenantMembership.update({
        where: { userId_tenantId: { userId, tenantId } },
        data: { role },
      })

      const response = await agent.get('/api/admin/access-check').set('x-tenant-id', tenantId).expect(403)

      expect(response.body.message).toBe('ViewPro admin access required')
    },
  )

  it('allows VIEWPRO_ADMIN access with a minimal sanitized response', async () => {
    const { agent, userId } = await registerTenantSession('admin@example.com', 'Admin Homes')
    await prisma.user.update({ where: { id: userId }, data: { globalRole: GlobalRole.VIEWPRO_ADMIN } })

    const response = await agent.get('/api/admin/access-check').expect(200)

    expect(response.body).toEqual({ access: 'granted', globalRole: GlobalRole.VIEWPRO_ADMIN })
  })

  it('allows VIEWPRO_ADMIN access without x-tenant-id', async () => {
    const { agent, userId } = await registerTenantSession('admin-no-tenant@example.com', 'Admin No Tenant Homes')
    await prisma.user.update({ where: { id: userId }, data: { globalRole: GlobalRole.VIEWPRO_ADMIN } })

    await agent.get('/api/admin/access-check').expect(200)
  })

  it('does not derive admin access from a tenant header', async () => {
    const { agent, tenantId } = await registerTenantSession('tenant-header@example.com', 'Tenant Header Homes')

    const response = await agent.get('/api/admin/access-check').set('x-tenant-id', tenantId).expect(403)

    expect(response.body.message).toBe('ViewPro admin access required')
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
