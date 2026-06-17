/**
 * E2E tests for the WhatsApp phone endpoints (Stage 23.3 — Phase 3).
 *
 * Covers:
 *   S-1  — PRINCIPAL_MANAGER PATCH valid phone → 204; GET returns updated value
 *   S-2  — PRINCIPAL_MANAGER PATCH null → 204; GET returns null
 *   S-3  — PATCH too-short phone → 400 with code phone.too_short
 *   S-4  — MANAGER role PATCH → 403
 *   S-5  — AGENT role PATCH → 403
 *   S-6  — Unauthenticated PATCH → 401
 *   GET  — Unauthenticated GET → 401
 *   GET  — MANAGER role GET → 403
 */

import type { INestApplication } from '@nestjs/common'
import { TenantRole } from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Tenants WhatsApp Phone (e2e)', () => {
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
    await prisma.tenantMovementOutcomeLabel.deleteMany()
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

  // ─── S-1: Valid phone, PRINCIPAL_MANAGER ─────────────────────────────────────

  it('S-1: PRINCIPAL_MANAGER PATCH valid phone → 204; subsequent GET returns same value', async () => {
    const manager = await registerTenantSession('pm-patch-valid@example.com', 'PM Patch Valid Homes')

    await manager.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .send({ whatsappPhone: '+5493510000000' })
      .expect(204)

    const getRes = await manager.agent
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(getRes.body).toEqual({ whatsappPhone: '+5493510000000' })

    // Verify persisted value in DB directly
    const row = await prisma.tenant.findUnique({
      where: { id: manager.tenantId },
      select: { whatsappPhone: true },
    })
    expect(row?.whatsappPhone).toBe('+5493510000000')
  })

  // ─── S-2: Clear phone to null ─────────────────────────────────────────────────

  it('S-2: PRINCIPAL_MANAGER PATCH null → 204; GET returns { whatsappPhone: null }', async () => {
    const manager = await registerTenantSession('pm-clear-phone@example.com', 'PM Clear Phone Homes')

    // First set a value
    await manager.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .send({ whatsappPhone: '+5493510000000' })
      .expect(204)

    // Then clear it
    await manager.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .send({ whatsappPhone: null })
      .expect(204)

    const getRes = await manager.agent
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(getRes.body).toEqual({ whatsappPhone: null })

    const row = await prisma.tenant.findUnique({
      where: { id: manager.tenantId },
      select: { whatsappPhone: true },
    })
    expect(row?.whatsappPhone).toBeNull()
  })

  // ─── S-3: Phone too short ─────────────────────────────────────────────────────

  it('S-3: PATCH too-short phone → 400 with error code phone.too_short', async () => {
    const manager = await registerTenantSession('pm-too-short@example.com', 'PM Too Short Homes')

    const res = await manager.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .send({ whatsappPhone: '123' })
      .expect(400)

    expect(res.body).toMatchObject({ errorCode: 'phone.too_short' })
  })

  // ─── S-4: MANAGER role → 403 ─────────────────────────────────────────────────

  it('S-4: MANAGER role PATCH → 403 (no TENANT_MANAGE_SETTINGS permission)', async () => {
    // Register owner tenant
    const owner = await registerTenantSession('owner-for-manager@example.com', 'Owner For Manager Homes')
    // Register a second user (their own PRINCIPAL_MANAGER on another tenant)
    const secondUser = await registerTenantSession('manager-user@example.com', 'Second User Homes')

    // Add second user as MANAGER on owner's tenant
    await addTenantMember(secondUser.userId, owner.tenantId, TenantRole.MANAGER)

    // Second user PATCHes on owner's tenant as MANAGER → must get 403
    await secondUser.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', owner.tenantId)
      .send({ whatsappPhone: '+5493510000000' })
      .expect(403)
  })

  // ─── S-5: AGENT role → 403 ───────────────────────────────────────────────────

  it('S-5: AGENT role PATCH → 403 (no TENANT_MANAGE_SETTINGS permission)', async () => {
    const owner = await registerTenantSession('owner-for-agent@example.com', 'Owner For Agent Homes')
    const agentUser = await registerTenantSession('agent-user@example.com', 'Agent User Homes')

    // Add agentUser as AGENT on owner's tenant
    await addTenantMember(agentUser.userId, owner.tenantId, TenantRole.AGENT)

    await agentUser.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', owner.tenantId)
      .send({ whatsappPhone: '+5493510000000' })
      .expect(403)
  })

  // ─── S-6: Unauthenticated → 401 ──────────────────────────────────────────────

  it('S-6: unauthenticated PATCH → 401', async () => {
    const owner = await registerTenantSession('owner-for-unauth@example.com', 'Owner For Unauth Homes')

    // Use a fresh non-authenticated agent
    await request(app.getHttpServer())
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', owner.tenantId)
      .send({ whatsappPhone: '+5493510000000' })
      .expect(401)
  })

  // ─── GET guards ──────────────────────────────────────────────────────────────

  it('unauthenticated GET → 401', async () => {
    const owner = await registerTenantSession('owner-for-unauth-get@example.com', 'Owner Unauth GET Homes')

    await request(app.getHttpServer())
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', owner.tenantId)
      .expect(401)
  })

  it('MANAGER role GET → 403 (GET also requires TENANT_MANAGE_SETTINGS)', async () => {
    const owner = await registerTenantSession('owner-for-manager-get@example.com', 'Owner Manager GET Homes')
    const managerUser = await registerTenantSession('manager-get-user@example.com', 'Manager GET User Homes')

    await addTenantMember(managerUser.userId, owner.tenantId, TenantRole.MANAGER)

    await managerUser.agent
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', owner.tenantId)
      .expect(403)
  })

  // ─── Normalization round-trip ─────────────────────────────────────────────────

  it('PATCH strips separators; GET returns the normalized stored value', async () => {
    const manager = await registerTenantSession('pm-normalize@example.com', 'PM Normalize Homes')

    await manager.agent
      .patch('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .send({ whatsappPhone: ' +54 9 351-000-0000 ' })
      .expect(204)

    const getRes = await manager.agent
      .get('/api/tenants/me/whatsapp-phone')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(getRes.body).toEqual({ whatsappPhone: '+5493510000000' })
  })

  // ─── Helper functions ─────────────────────────────────────────────────────────

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

  async function addTenantMember(userId: string, tenantId: string, role: TenantRole) {
    return prisma.tenantMembership.create({
      data: { userId, tenantId, role },
    })
  }
})
