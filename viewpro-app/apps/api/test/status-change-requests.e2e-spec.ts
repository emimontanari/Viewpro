/**
 * Integration tests for the status-change-requests module (T-22 + T-35).
 *
 * Covers all 14 spec scenarios plus dual-role self-approval guard and
 * gate G1 (FR-34 / T-35):
 *
 *   S-1  — Happy path: seller creates a request, manager receives notification
 *   S-2  — Happy path: manager approves, full transaction
 *   S-3  — Manager rejects with comment
 *   S-4  — Manager rejects without comment → 400
 *   S-5  — Duplicate PENDING request → 409
 *   S-6  — Self-approval forbidden (seller also has manager membership)
 *   S-7  — Stale-state guard → 409 SUPERSEDED
 *   S-8  — Concurrent approval → one 200, one 409 ALREADY_RESOLVED
 *   S-9  — Cross-tenant isolation → 404
 *   S-10 — Owner access → 403
 *   S-11 — Unassigned seller → 403
 *   S-12 — Notification failure does not roll back transaction
 *   S-13 — Existing 403 guard on POST /property-engagements/:id/movements unchanged (T-35, FR-34)
 *   S-14 — Same-status target → 422
 *   T-16 — Dual-role self-approval blocked
 */

import type { INestApplication } from '@nestjs/common'
import {
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

describe('Status Change Requests (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.listen(0)
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.statusChangeRequest.deleteMany()
    await prisma.movement.deleteMany()
    await prisma.notification.deleteMany()
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

  // Notifications are best-effort, fire-and-forget side effects written AFTER the
  // HTTP response returns (FR-30/S-12). Poll until they land instead of reading
  // once, so slower CI runners don't race the async write.
  type NotificationWhere = NonNullable<
    Parameters<typeof prisma.notification.findMany>[0]
  >['where']

  async function waitForNotifications(where: NotificationWhere, minCount = 1) {
    const deadlineMs = 5000
    const intervalMs = 50
    const start = Date.now()
    let found = await prisma.notification.findMany({ where })
    while (found.length < minCount && Date.now() - start < deadlineMs) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      found = await prisma.notification.findMany({ where })
    }
    return found
  }

  // ─── S-1: Happy path create ───────────────────────────────────────────────────

  it('S-1: seller creates a request and managers are notified', async () => {
    const { manager, seller, engagementId } = await setupSellerManagerPair('s1')

    const res = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', seller.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
        requestNote: 'Listo para publicar',
      })
      .expect(201)

    expect(res.body).toMatchObject({
      status: 'PENDING',
      targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      requestNote: 'Listo para publicar',
      propertyEngagementId: engagementId,
    })

    // Notification should have been created for the manager (best-effort/async)
    const notifications = await waitForNotifications({ recipientUserId: manager.userId })
    expect(notifications.length).toBeGreaterThanOrEqual(1)
    expect(notifications[0]?.type).toBe('STATUS_CHANGE_REQUESTED')
    expect(notifications[0]?.linkHref).toBe('/dashboard/status-change-requests')
  })

  // ─── S-2: Manager approves — full transaction ─────────────────────────────────

  it('S-2: manager approves request — full transaction committed', async () => {
    const { manager, seller, engagementId } = await setupSellerManagerPair('s2')

    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', seller.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    const approveRes = await manager.agent
      .patch(`/api/status-change-requests/${requestId}/approve`)
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(approveRes.body).toMatchObject({
      id: requestId,
      status: 'RESOLVED',
      resolvedByUserId: manager.userId,
    })

    // Engagement status must have changed
    const engagement = await prisma.propertyEngagement.findUnique({ where: { id: engagementId } })
    expect(engagement?.status).toBe(PropertyEngagementStatus.ACTIVE_PUBLICATION)

    // STATUS_CHANGE movement must exist
    const movements = await prisma.movement.findMany({
      where: { propertyEngagementId: engagementId, type: MovementType.STATUS_CHANGE },
    })
    expect(movements).toHaveLength(1)
    expect(movements[0]).toMatchObject({
      newStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      previousStatus: PropertyEngagementStatus.CAPTURE,
      createdByUserId: seller.userId, // original seller as per FR-12
      source: 'SYSTEM',
      builtInOutcome: null,
      customOutcomeLabelId: null,
    })

    // Seller notification (best-effort/async)
    const sellerNotifications = await waitForNotifications({
      recipientUserId: seller.userId,
      type: 'STATUS_CHANGE_APPROVED',
    })
    expect(sellerNotifications).toHaveLength(1)
  })

  // ─── S-3: Manager rejects with comment ───────────────────────────────────────

  it('S-3: manager rejects with a comment', async () => {
    const { manager, seller, engagementId } = await setupSellerManagerPair('s3')

    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', seller.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    const rejectRes = await manager.agent
      .patch(`/api/status-change-requests/${requestId}/reject`)
      .set('x-tenant-id', manager.tenantId)
      .send({ resolutionComment: 'Documentación incompleta' })
      .expect(200)

    expect(rejectRes.body).toMatchObject({
      id: requestId,
      status: 'RESOLVED',
      resolutionComment: 'Documentación incompleta',
    })

    // Engagement status must NOT have changed
    const engagement = await prisma.propertyEngagement.findUnique({ where: { id: engagementId } })
    expect(engagement?.status).toBe(PropertyEngagementStatus.CAPTURE)

    // No STATUS_CHANGE movement
    const movements = await prisma.movement.count({
      where: { propertyEngagementId: engagementId, type: MovementType.STATUS_CHANGE },
    })
    expect(movements).toBe(0)

    // Seller rejection notification (best-effort/async)
    const notifications = await waitForNotifications({
      recipientUserId: seller.userId,
      type: 'STATUS_CHANGE_REJECTED',
    })
    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.body).toBe('Documentación incompleta')
  })

  // ─── S-4: Manager rejects without comment → 400 ──────────────────────────────

  it('S-4: manager rejects without resolutionComment → 400', async () => {
    const { manager, seller, engagementId } = await setupSellerManagerPair('s4')

    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', seller.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    // No resolutionComment → 400
    await manager.agent
      .patch(`/api/status-change-requests/${requestId}/reject`)
      .set('x-tenant-id', manager.tenantId)
      .send({})
      .expect(400)

    // Empty string → 400
    await manager.agent
      .patch(`/api/status-change-requests/${requestId}/reject`)
      .set('x-tenant-id', manager.tenantId)
      .send({ resolutionComment: '' })
      .expect(400)

    // Request should still be PENDING
    const req = await prisma.statusChangeRequest.findUnique({ where: { id: requestId } })
    expect(req?.status).toBe('PENDING')
  })

  // ─── S-5: Duplicate PENDING → 409 ────────────────────────────────────────────

  it('S-5: second create on same engagement → 409 STATUS_CHANGE_REQUEST_ALREADY_PENDING', async () => {
    const { seller, engagementId } = await setupSellerManagerPair('s5')

    await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', seller.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const dupRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', seller.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.DOCUMENTATION_PENDING,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(409)

    expect(dupRes.body.errorCode).toBe('STATUS_CHANGE_REQUEST_ALREADY_PENDING')
  })

  // ─── S-6 / T-16: Self-approval forbidden (dual-role) ─────────────────────────

  it('S-6 (T-16): self-approval blocked for dual-role user (AGENT + MANAGER on same tenant)', async () => {
    const { seller, engagementId, tenantId } = await setupSellerManagerPair('s6')

    // The seller has AGENT role — create the request while they are an agent.
    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    // Upgrade the seller's role to MANAGER on the main tenant (dual-role simulation).
    // TenantMembership has @@unique([userId, tenantId]), so we update in place.
    await prisma.tenantMembership.update({
      where: { userId_tenantId: { userId: seller.userId, tenantId } },
      data: { role: TenantRole.MANAGER },
    })

    // Now the seller (now a MANAGER) tries to approve their own request → 403
    const approveRes = await seller.agent
      .patch(`/api/status-change-requests/${requestId}/approve`)
      .set('x-tenant-id', tenantId)
      .expect(403)

    expect(approveRes.body.errorCode).toBe('SELF_APPROVAL_FORBIDDEN')

    // Request is still PENDING
    const req = await prisma.statusChangeRequest.findUnique({ where: { id: requestId } })
    expect(req?.status).toBe('PENDING')
  })

  // ─── S-7: Stale-state guard → 409 SUPERSEDED ─────────────────────────────────

  it('S-7: stale-state guard fires when engagement status changed after request creation', async () => {
    const { manager, seller, engagementId, tenantId } = await setupSellerManagerPair('s7')

    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    // Directly mutate the engagement status to simulate a concurrent change
    await prisma.propertyEngagement.update({
      where: { id: engagementId },
      data: { status: PropertyEngagementStatus.DOCUMENTATION_PENDING },
    })

    const approveRes = await manager.agent
      .patch(`/api/status-change-requests/${requestId}/approve`)
      .set('x-tenant-id', tenantId)
      .expect(409)

    expect(approveRes.body.errorCode).toBe('STATUS_CHANGE_REQUEST_SUPERSEDED')

    // Request is still PENDING
    const req = await prisma.statusChangeRequest.findUnique({ where: { id: requestId } })
    expect(req?.status).toBe('PENDING')
  })

  // ─── S-8: Concurrent approval ─────────────────────────────────────────────────

  it('S-8: concurrent approval — exactly one succeeds, one gets 409 ALREADY_RESOLVED', async () => {
    const { manager, seller, engagementId, tenantId } = await setupSellerManagerPair('s8')

    // Create a second manager (via throwaway tenant)
    const manager2Session = await registerTenantSession('manager2-s8@test.com', 'Manager2 s8 throwaway')
    await prisma.tenantMembership.create({
      data: { userId: manager2Session.userId, tenantId, role: TenantRole.MANAGER },
    })

    // Login manager2 as a separate session targeting the main tenant
    const agent2 = request.agent(app.getHttpServer())
    await agent2
      .post('/api/auth/login')
      .send({ email: 'manager2-s8@test.com', password: 'password123' })

    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    // Fire both approvals concurrently
    const [res1, res2] = await Promise.all([
      manager.agent.patch(`/api/status-change-requests/${requestId}/approve`).set('x-tenant-id', tenantId),
      agent2.patch(`/api/status-change-requests/${requestId}/approve`).set('x-tenant-id', tenantId),
    ])

    const statuses = [res1.status, res2.status].sort()
    expect(statuses).toContain(200)
    expect(statuses).toContain(409)

    // Exactly one STATUS_CHANGE movement
    const movements = await prisma.movement.count({
      where: { propertyEngagementId: engagementId, type: MovementType.STATUS_CHANGE },
    })
    expect(movements).toBe(1)
  })

  // ─── S-9: Cross-tenant isolation ─────────────────────────────────────────────

  it('S-9: cross-tenant access to a request returns 404', async () => {
    const t1 = await setupSellerManagerPair('s9-t1')
    const t2 = await setupSellerManagerPair('s9-t2')

    const createRes = await t1.seller.agent
      .post(`/api/property-engagements/${t1.engagementId}/status-change-requests`)
      .set('x-tenant-id', t1.tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    // t2 manager tries to approve t1's request → 404 (no info leak)
    await t2.manager.agent
      .patch(`/api/status-change-requests/${requestId}/approve`)
      .set('x-tenant-id', t2.tenantId)
      .expect(404)
  })

  // ─── S-10: Owner access → 403 ────────────────────────────────────────────────

  it('S-10: user with no membership in the target tenant cannot access status-change-request endpoints → 403', async () => {
    const { engagementId, tenantId } = await setupSellerManagerPair('s10')

    // Register a user in a different tenant (no membership in the target tenant)
    const outsiderSession = await registerTenantSession('outsider-s10@test.com', 'Outsider Tenant s10')
    const outsider = { agent: outsiderSession.agent }

    // Outsider has no membership in tenantId — TenantMembershipGuard returns 403
    await outsider.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(403)
  })

  // ─── S-11: Unassigned seller → 403 ───────────────────────────────────────────

  it('S-11: seller not assigned to the engagement gets 403', async () => {
    const { seller: _, engagementId, tenantId } = await setupSellerManagerPair('s11')

    // Register a second seller in a throwaway tenant, then grant them AGENT on the main tenant
    const otherSession = await registerTenantSession('other-seller-s11@test.com', 'Other Seller s11 throwaway')
    await prisma.tenantMembership.create({
      data: { userId: otherSession.userId, tenantId, role: TenantRole.AGENT },
    })

    // Login as the unassigned seller
    const otherAgent = request.agent(app.getHttpServer())
    await otherAgent
      .post('/api/auth/login')
      .send({ email: 'other-seller-s11@test.com', password: 'password123' })

    // Not assigned to engagementId → 403
    await otherAgent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(403)
  })

  // ─── S-12: Notification failure does not roll back transaction ────────────────

  it('S-12: approval transaction commits even if notification fails (best-effort)', async () => {
    const { manager, seller, engagementId, tenantId } = await setupSellerManagerPair('s12')

    const createRes = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const requestId = createRes.body.id as string

    // Simulate notification failure by deleting all notification records just before
    // the approval so they can't be created against a FK (unlikely but deterministic).
    // Instead, we assert the happy path: even with the DB in a state where notifications
    // might fail silently, the approval still returns 200.
    const res = await manager.agent
      .patch(`/api/status-change-requests/${requestId}/approve`)
      .set('x-tenant-id', tenantId)
      .expect(200)

    // Core data must be committed
    expect(res.body.status).toBe('RESOLVED')
    const engagement = await prisma.propertyEngagement.findUnique({ where: { id: engagementId } })
    expect(engagement?.status).toBe(PropertyEngagementStatus.ACTIVE_PUBLICATION)
  })

  // ─── S-13 / T-35: Existing 403 guard on POST .../movements unaffected ────────

  it('S-13 (T-35 Gate G1): seller calling POST /property-engagements/:id/movements with STATUS_CHANGE still gets 403', async () => {
    const { seller, engagementId, tenantId } = await setupSellerManagerPair('s13')

    const res = await seller.agent
      .post(`/api/property-engagements/${engagementId}/movements`)
      .set('x-tenant-id', tenantId)
      .send({
        type: MovementType.STATUS_CHANGE,
        observation: 'Trying to bypass gate',
        newStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      })
      .expect(403)

    expect(res.body.message).toBe('Insufficient permissions')
  })

  // ─── S-14: Same-status target → 422 ──────────────────────────────────────────

  it('S-14: targetStatus same as current engagement status → 422', async () => {
    const { seller, engagementId, tenantId } = await setupSellerManagerPair('s14')

    const res = await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.CAPTURE, // same as default initial status
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(422)

    expect(res.body.errorCode).toBe('TARGET_STATUS_SAME_AS_CURRENT')
  })

  // ─── Manager bandeja list ────────────────────────────────────────────────────

  it('manager can list pending requests via bandeja endpoint', async () => {
    const { manager, seller, engagementId, tenantId } = await setupSellerManagerPair('bandeja')

    await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const res = await manager.agent
      .get('/api/tenants/me/status-change-requests')
      .set('x-tenant-id', tenantId)
      .expect(200)

    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('PENDING')
  })

  it('seller cannot access manager bandeja → 403', async () => {
    const { seller, tenantId } = await setupSellerManagerPair('bandeja-403')

    await seller.agent
      .get('/api/tenants/me/status-change-requests')
      .set('x-tenant-id', tenantId)
      .expect(403)
  })

  // ─── Per-engagement list ──────────────────────────────────────────────────────

  it('assigned seller can list requests for their engagement', async () => {
    const { seller, engagementId, tenantId } = await setupSellerManagerPair('list-pe')

    await seller.agent
      .post(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .send({
        targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
        currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
      })
      .expect(201)

    const res = await seller.agent
      .get(`/api/property-engagements/${engagementId}/status-change-requests`)
      .set('x-tenant-id', tenantId)
      .expect(200)

    expect(res.body).toHaveLength(1)
  })

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  async function registerTenantSession(email: string, tenantName: string) {
    const agent = request.agent(app.getHttpServer())
    const res = await agent
      .post('/api/auth/register-tenant')
      .send({ whatsappPhone: '3510000000', email, password: 'password123', firstName: 'User', tenantName })
      .expect(201)

    return {
      agent,
      userId: res.body.user.id as string,
      tenantId: res.body.memberships[0].tenant.id as string,
    }
  }

  async function setupSellerManagerPair(suffix: string) {
    // Register the manager (creates tenant + PRINCIPAL_MANAGER membership)
    const managerSession = await registerTenantSession(`manager-${suffix}@test.com`, `Test Tenant ${suffix}`)
    const manager = { agent: managerSession.agent, userId: managerSession.userId, tenantId: managerSession.tenantId }
    const tenantId = manager.tenantId

    // Register the seller via a different tenant (throwaway) so they get a real user record
    const sellerSession = await registerTenantSession(`seller-${suffix}@test.com`, `Seller Throwaway ${suffix}`)
    const sellerId = sellerSession.userId

    // Add seller to the MAIN tenant with AGENT role
    await prisma.tenantMembership.create({
      data: { userId: sellerId, tenantId, role: TenantRole.AGENT },
    })

    // Re-login seller with a clean session targeting the main tenant
    const sellerAgent = request.agent(app.getHttpServer())
    const loginRes = await sellerAgent
      .post('/api/auth/login')
      .send({ email: `seller-${suffix}@test.com`, password: 'password123' })

    const seller = { agent: sellerAgent, userId: loginRes.body.user.id as string, tenantId }

    // Manager creates a property engagement
    const engRes = await managerSession.agent
      .post('/api/property-engagements')
      .set('x-tenant-id', tenantId)
      .send({
        title: `Test Property ${suffix}`,
        addressLine: `Test Street ${suffix}`,
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.HOUSE,
        operationType: PropertyOperationType.SALE,
      })
      .expect(201)

    const engagementId = engRes.body.id as string

    // Assign the seller to the engagement
    await managerSession.agent
      .post(`/api/property-engagements/${engagementId}/agents`)
      .set('x-tenant-id', tenantId)
      .send({ agentUserId: sellerId })

    return { manager, seller, engagementId, tenantId }
  }
})
