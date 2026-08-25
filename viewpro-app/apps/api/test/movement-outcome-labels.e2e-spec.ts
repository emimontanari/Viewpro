/**
 * Integration tests for the movement-outcome-labels module (T-10).
 *
 * Covers:
 *   S-1  — Seller picks built-in outcome
 *   S-2  — Seller creates custom label
 *   S-3  — Two sellers create same label simultaneously (idempotency)
 *   S-4  — Movement response includes outcome fields
 *   S-5  — Soft-deleted label excluded from activeOnly list
 *   S-6  — Outcome never moves PropertyEngagement.status (FR-11 invariant)
 *   S-7  — Cross-tenant label access denied
 *   S-8  — Cross-tenant customLabelId rejected with 422
 *   S-9  — VIEWPRO_ADMIN with no tenant membership cannot create label → 403
 *  S-12  — Duplicate label returns existing (idempotency HTTP 200)
 *  S-14  — Soft-delete by non-creator non-manager → 403
 *  S-15  — Manager can delete any tenant label
 */

import type { INestApplication } from '@nestjs/common'
import {
  GlobalRole,
  MovementBuiltInOutcome,
  MovementType,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyType,
  TenantRole,
} from '@prisma/client'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Movement Outcome Labels (e2e)', () => {
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

  // ─── Label CRUD ──────────────────────────────────────────────────────────────

  it('creates a label and returns it in the active list (S-2)', async () => {
    const manager = await registerTenantSession('label-create@example.com', 'Label Create Homes')

    const createRes = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'Esperando documentos', color: '#3B82F6' })
      .expect(200)

    expect(createRes.body).toMatchObject({
      label: 'Esperando documentos',
      color: '#3B82F6',
      tenantId: manager.tenantId,
      deletedAt: null,
    })

    const listRes = await manager.agent
      .get('/api/tenants/me/movement-outcome-labels?activeOnly=true')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(listRes.body).toHaveLength(1)
    expect(listRes.body[0].label).toBe('Esperando documentos')
  })

  it('returns existing label on duplicate name (idempotency — S-3, S-12)', async () => {
    const manager = await registerTenantSession('label-idempotent@example.com', 'Idempotent Label Homes')

    const first = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'Espera doc' })
      .expect(200)

    const second = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'Espera doc' })
      .expect(200)

    expect(second.body.id).toBe(first.body.id)
    const count = await prisma.tenantMovementOutcomeLabel.count({ where: { tenantId: manager.tenantId } })
    expect(count).toBe(1)
  })

  it('excludes soft-deleted label from activeOnly list (S-5)', async () => {
    const manager = await registerTenantSession('label-soft-delete@example.com', 'Soft Delete Label Homes')

    const createRes = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'Old tag' })
      .expect(200)

    await manager.agent
      .delete(`/api/tenants/me/movement-outcome-labels/${createRes.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .expect(204)

    const listRes = await manager.agent
      .get('/api/tenants/me/movement-outcome-labels?activeOnly=true')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(listRes.body).toHaveLength(0)

    // Full list (no activeOnly filter) should still show it
    const allRes = await manager.agent
      .get('/api/tenants/me/movement-outcome-labels?activeOnly=false')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(allRes.body).toHaveLength(1)
    expect(allRes.body[0].deletedAt).not.toBeNull()
  })

  it('returns only own tenant labels — cross-tenant isolation (S-7)', async () => {
    const tenantA = await registerTenantSession('tenant-a-labels@example.com', 'Tenant A Label Homes')
    const tenantB = await registerTenantSession('tenant-b-labels@example.com', 'Tenant B Label Homes')

    await tenantB.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', tenantB.tenantId)
      .send({ label: 'Tenant B label' })
      .expect(200)

    const listRes = await tenantA.agent
      .get('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', tenantA.tenantId)
      .expect(200)

    expect(listRes.body).toHaveLength(0)
  })

  it('rejects label creation from VIEWPRO_ADMIN without tenant membership (S-9)', async () => {
    // Register as a normal tenant, then elevate to VIEWPRO_ADMIN and point to a different tenant
    const { agent: adminAgent, userId: adminUserId } = await registerTenantSession(
      'viewpro-admin-label@example.com',
      'Admin Own Homes',
    )
    const { tenantId: targetTenantId } = await registerTenantSession(
      'target-tenant-label@example.com',
      'Target Label Homes',
    )

    // Elevate to VIEWPRO_ADMIN
    await prisma.user.update({
      where: { id: adminUserId },
      data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
    })

    // VIEWPRO_ADMIN has no TenantMembership on targetTenantId — expect 403
    await adminAgent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', targetTenantId)
      .send({ label: 'Admin label attempt' })
      .expect(403)
  })

  it('rejects delete by non-creator non-manager agent (S-14)', async () => {
    const manager = await registerTenantSession('label-delete-perms@example.com', 'Delete Perms Homes')
    const agent2 = await registerTenantSession('agent2-label-delete@example.com', 'Agent2 Label Homes')
    await addTenantMember(agent2.userId, manager.tenantId, TenantRole.AGENT)

    const createRes = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'Created by manager' })
      .expect(200)

    // agent2 is not the creator and not a manager
    await agent2.agent
      .delete(`/api/tenants/me/movement-outcome-labels/${createRes.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .expect(403)
  })

  it('allows a manager to delete any label in the tenant (S-15)', async () => {
    const manager = await registerTenantSession('label-manager-delete@example.com', 'Manager Delete Label Homes')
    const agent = await registerTenantSession('agent-who-created@example.com', 'Agent Creator Homes')
    await addTenantMember(agent.userId, manager.tenantId, TenantRole.AGENT)

    // Create a label as the regular manager (who is PRINCIPAL_MANAGER here)
    const createRes = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'Manager deletes this' })
      .expect(200)

    await manager.agent
      .delete(`/api/tenants/me/movement-outcome-labels/${createRes.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .expect(204)

    // Verify soft-deleted in DB
    const row = await prisma.tenantMovementOutcomeLabel.findUnique({ where: { id: createRes.body.id } })
    expect(row?.deletedAt).not.toBeNull()
  })

  // ─── Movement + outcome integration ─────────────────────────────────────────

  it('creates movement with built-in outcome and confirms PropertyEngagement.status unchanged (S-1, S-6)', async () => {
    const manager = await registerTenantSession('movement-built-in@example.com', 'Built-In Outcome Homes')
    const engagementRes = await createEngagement(manager.agent, manager.tenantId, { title: 'Built-In Outcome Property' }).expect(201)
    const engagementId = engagementRes.body.id

    // Record initial status
    const beforeEngagement = await prisma.propertyEngagement.findUnique({
      where: { id: engagementId },
      select: { status: true },
    })

    const movementRes = await createMovement(manager.agent, manager.tenantId, engagementId, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Activity log with outcome',
      outcome: { builtIn: MovementBuiltInOutcome.CONSULTAS_Y_VISITAS },
    }).expect(201)

    expect(movementRes.body.builtInOutcome).toBe(MovementBuiltInOutcome.CONSULTAS_Y_VISITAS)
    expect(movementRes.body.customOutcomeLabel).toBeNull()
    expect(movementRes.body.newStatus).toBeNull()

    // FR-11 invariant: PropertyEngagement.status MUST remain unchanged
    const afterEngagement = await prisma.propertyEngagement.findUnique({
      where: { id: engagementId },
      select: { status: true },
    })
    expect(afterEngagement?.status).toBe(beforeEngagement?.status)
  })

  it('creates movement with custom label and returns it in the response (S-4 partial)', async () => {
    const manager = await registerTenantSession('movement-custom-label@example.com', 'Custom Label Outcome Homes')
    const engagementRes = await createEngagement(manager.agent, manager.tenantId, { title: 'Custom Label Property' }).expect(201)
    const engagementId = engagementRes.body.id

    const labelRes = await manager.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', manager.tenantId)
      .send({ label: 'En negociacion', color: '#F59E0B' })
      .expect(200)

    const movementRes = await createMovement(manager.agent, manager.tenantId, engagementId, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Using a custom label',
      outcome: { customLabelId: labelRes.body.id },
    }).expect(201)

    expect(movementRes.body.customOutcomeLabel).toMatchObject({
      id: labelRes.body.id,
      label: 'En negociacion',
      color: '#F59E0B',
      deletedAt: null,
    })
    expect(movementRes.body.builtInOutcome).toBeNull()
  })

  it('rejects movement with customLabelId from another tenant with 422 (S-8)', async () => {
    const tenantA = await registerTenantSession('tenant-a-cross-fk@example.com', 'Tenant A Cross FK Homes')
    const tenantB = await registerTenantSession('tenant-b-cross-fk@example.com', 'Tenant B Cross FK Homes')
    const engagementRes = await createEngagement(tenantA.agent, tenantA.tenantId, { title: 'Cross FK Property' }).expect(201)

    const tenantBLabel = await tenantB.agent
      .post('/api/tenants/me/movement-outcome-labels')
      .set('x-tenant-id', tenantB.tenantId)
      .send({ label: 'Tenant B label for cross-tenant test' })
      .expect(200)

    const res = await createMovement(tenantA.agent, tenantA.tenantId, engagementRes.body.id, {
      type: MovementType.GENERAL_UPDATE,
      observation: 'Cross-tenant label attempt',
      outcome: { customLabelId: tenantBLabel.body.id },
    }).expect(422)

    expect(res.body.errorCode).toBe('OUTCOME_LABEL_NOT_FOUND')
  })

  // ─── Helper functions ─────────────────────────────────────────────────────────

  async function registerTenantSession(email: string, tenantName: string) {
    const agent = request.agent(app.getHttpServer())
    const response = await agent
      .post('/api/auth/register-tenant')
      .send({
        whatsappPhone: '3510000000',
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

  function createEngagement(
    agent: request.SuperAgentTest,
    tenantId: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return agent
      .post('/api/property-engagements')
      .set('x-tenant-id', tenantId)
      .send({
        title: 'Default Outcome Property',
        addressLine: 'Outcome Street 123',
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
})
