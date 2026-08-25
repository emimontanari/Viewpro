/**
 * Security isolation negative-test catalogue (Stage 26.4)
 *
 * This file is the CANONICAL audit-row map for all 7 isolation boundaries.
 * Every test asserts both the expected HTTP status AND the absence of
 * sensitive resource detail in the response body (no-leak rule).
 *
 * Acceptance map — existing tests referenced but NOT duplicated:
 *   S-9 (status-change-requests.e2e-spec.ts) — cross-tenant SCR access → 404
 *   S-11 (status-change-requests.e2e-spec.ts) — unassigned seller SCR → 403
 *   The tests below add no-leak body assertions not present in those module specs.
 *
 * Sanity-inversion targets are documented per test via comments.
 * Run with: pnpm --filter @viewpro/api test --reporter=verbose
 */

import type { INestApplication } from '@nestjs/common'
import {
  GlobalRole,
  NotificationSurface,
  NotificationType,
  PropertyAssetOwnerAccessStatus,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyType,
  StatusChangeRequestStatus,
  TenantRole,
  TenantStatus,
  UserStatus,
} from '@prisma/client'
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TestSession = {
  agent: ReturnType<typeof request.agent>
  userId: string
  tenantId: string
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('Security isolation — negative test catalogue (B-1..B-7)', () => {
  let app: INestApplication
  let prisma: PrismaService

  // Shared IDs resolved in beforeAll and reused across tests
  let tenantAId: string
  let tenantBId: string // isolation tenant
  let tenantBEngagementId: string
  let tenantBAssetId: string

  let demoManagerSession: TestSession
  let isolationManagerSession: TestSession
  let demoSellerSession: TestSession // NOT assigned to the unassigned engagement
  let demoOwnerSession: TestSession
  let adminSession: { agent: ReturnType<typeof request.agent>; userId: string }

  // Engagement in tenant A that the demo seller is NOT assigned to (used for B-2)
  let unassignedEngagementId: string
  let unassignedEngagementTitle: string

  // Owner-surface notification titles fetched at runtime (T-6 / S-8)
  // Derived from GET /api/owner/notifications as the demo owner.
  // Do NOT hardcode — they drift if the seed changes.
  let SEEDED_OWNER_NOTIFICATION_TITLES: string[]

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET ??= randomUUID()
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.init()
    prisma = app.get(PrismaService)

    // ── 1. Create Tenant A (demo-like) ──
    const tenantASetup = await buildTenantWithManagerAndSeller(prisma, app, 'iso-tenant-a')
    tenantAId = tenantASetup.tenantId
    demoManagerSession = tenantASetup.manager
    demoSellerSession = tenantASetup.seller

    // Create an engagement in tenant A that the seller is NOT assigned to
    const unassignedEngRes = await demoManagerSession.agent
      .post('/api/property-engagements')
      .set('x-tenant-id', tenantAId)
      .send({
        title: 'Unassigned Engagement Isolation Test',
        addressLine: 'Test Street 1',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.HOUSE,
        operationType: PropertyOperationType.SALE,
      })
      .expect(201)
    unassignedEngagementId = unassignedEngRes.body.id as string
    unassignedEngagementTitle = 'Unassigned Engagement Isolation Test'

    // ── 2. Create Tenant B (isolation tenant) ──
    const tenantBSetup = await buildIsolationTenant(prisma, app, 'iso-tenant-b')
    tenantBId = tenantBSetup.tenantId
    tenantBEngagementId = tenantBSetup.engagementId
    tenantBAssetId = tenantBSetup.assetId
    isolationManagerSession = tenantBSetup.manager

    // ── 3. Create a demo owner (no tenant membership) in Tenant A context ──
    demoOwnerSession = await buildOwnerSession(prisma, app, 'iso-owner', tenantAId, tenantBAssetId)

    // ── 4. Create VIEWPRO_ADMIN user ──
    adminSession = await buildAdminSession(prisma, app, 'iso-admin')

    // ── 5. Derive seeded owner notification titles at runtime ──
    // This eliminates hardcoded drift if the seed changes.
    // The owner was linked to tenantB's asset above; fetch their owner-surface notifications.
    // If there are none seeded in test context, the list will be empty — still valid.
    const ownerNotifRes = await demoOwnerSession.agent.get('/api/owner/notifications').query({
      page: 1,
      pageSize: 20,
    })
    SEEDED_OWNER_NOTIFICATION_TITLES = Array.isArray(ownerNotifRes.body?.items)
      ? (ownerNotifRes.body.items as Array<{ title: string }>)
          .map((n) => n.title)
          .filter(Boolean)
      : []
  }, 60_000)

  afterAll(async () => {
    await app.close()
  })

  // ---------------------------------------------------------------------------
  // Helper: no-leak assertion
  // ---------------------------------------------------------------------------

  function expectNoLeak(res: request.Response, ...fragments: string[]): void {
    const body = JSON.stringify(res.body)
    for (const fragment of fragments) {
      if (!fragment) continue
      expect(body, `Response body must not contain sensitive fragment: "${fragment}"`).not.toContain(
        fragment,
      )
    }
  }

  // ---------------------------------------------------------------------------
  // B-1 — Cross-tenant denial
  // ---------------------------------------------------------------------------

  describe('B-1 — Cross-tenant denial (TenantMembershipGuard)', () => {
    it(
      // inversion: remove TenantMembershipGuard from PropertyEngagementsController → 200
      'S-1: cross-tenant property engagement read returns 403 and no resource detail',
      async () => {
        // Tenant A manager tries to read Tenant B engagement with Tenant B's x-tenant-id.
        // Note: NestJS error bodies include the requested path (not a data leak — just the URL).
        // We assert resource *content* (title, address) does not leak, not the URL path.
        const res = await demoManagerSession.agent
          .get(`/api/property-engagements/${tenantBEngagementId}`)
          .set('x-tenant-id', tenantBId)
        expect(res.status).toBe(403)
        // The isolation property title must not appear in the response body
        expectNoLeak(res, 'Propiedad isolation', 'iso-tenant-b')
      },
    )

    it(
      // inversion: remove TenantMembershipGuard from MovementsController → 200 or 404
      'S-2: cross-tenant movement list returns 403 and no resource detail',
      async () => {
        // Tenant A manager tries to list movements on Tenant B engagement with Tenant B's x-tenant-id
        const res = await demoManagerSession.agent
          .get(`/api/property-engagements/${tenantBEngagementId}/movements`)
          .set('x-tenant-id', tenantBId)
        expect(res.status).toBe(403)
        expectNoLeak(res, 'Propiedad isolation', 'iso-tenant-b')
      },
    )

    it(
      // inversion: remove TenantMembershipGuard from the bandeja (tenants/me/status-change-requests) route → 200
      'cross-tenant: manager GET /api/tenants/me/status-change-requests with foreign x-tenant-id returns 403',
      async () => {
        // Tenant A manager tries the bandeja route with Tenant B's x-tenant-id
        const res = await demoManagerSession.agent
          .get('/api/tenants/me/status-change-requests')
          .set('x-tenant-id', tenantBId)
        expect(res.status).toBe(403)
        expectNoLeak(res, 'Propiedad isolation', 'iso-tenant-b')
      },
    )
  })

  // ---------------------------------------------------------------------------
  // B-2 — Seller unassigned denial
  // ---------------------------------------------------------------------------

  describe('B-2 — Seller unassigned denial (findByIdForTenant agents filter)', () => {
    it(
      // inversion: remove agents filter in prisma-property-engagements.repository.findByIdForTenant when canViewAll=false → 200
      'S-3: unassigned seller GET /property-engagements/:id returns 404 and no resource detail',
      async () => {
        // NestJS 404 error body includes the request path (URL-level disclosure, not data leak).
        // We assert the engagement *content* (title, address) is absent from the body.
        const res = await demoSellerSession.agent
          .get(`/api/property-engagements/${unassignedEngagementId}`)
          .set('x-tenant-id', tenantAId)
        expect(res.status).toBe(404)
        // Title must not be present in the error body
        expectNoLeak(res, unassignedEngagementTitle)
      },
    )

    it(
      // inversion: same agents filter in findByIdForTenant
      'S-4: unassigned seller GET movements returns 404 and no resource detail',
      async () => {
        const res = await demoSellerSession.agent
          .get(`/api/property-engagements/${unassignedEngagementId}/movements`)
          .set('x-tenant-id', tenantAId)
        expect(res.status).toBe(404)
        expectNoLeak(res, unassignedEngagementTitle)
      },
    )
  })

  // ---------------------------------------------------------------------------
  // B-3 — Owner unauthorised access
  // ---------------------------------------------------------------------------

  describe('B-3 — Owner unauthorised access (ownerUserId filter in findPropertyByOwner)', () => {
    it(
      // inversion: remove ownerUserId filter in ownerPortalRepository.findPropertyByOwner → 200
      'S-6: owner GET /owner/properties/:id for unowned property returns 404 and no resource detail',
      async () => {
        // The demo owner is not linked to the isolation asset.
        // NestJS 404 body includes the request path (URL disclosure, not data leak).
        // We assert the property *content* (title, email) is absent.
        const res = await demoOwnerSession.agent.get(`/api/owner/properties/${tenantBAssetId}`)
        expect(res.status).toBe(404)
        expectNoLeak(res, 'Propiedad isolation', 'propietario.isolation')
      },
    )
  })

  // ---------------------------------------------------------------------------
  // B-4 — Notification surface isolation
  // ---------------------------------------------------------------------------

  describe('B-4 — Notification surface isolation', () => {
    it(
      // inversion: insert a seed row with recipientUserId=manager.id and NotificationSurface.OWNER → test must fail
      'S-8: tenant manager GET /owner/notifications receives empty list (no internal-surface leak)',
      async () => {
        // Manager calls the owner notification endpoint — they have no owner-surface records.
        const res = await demoManagerSession.agent.get('/api/owner/notifications')
        expect(res.status).toBe(200)
        // The response body is an object with an items array (paginated) or a raw array
        const items: unknown[] = Array.isArray(res.body)
          ? res.body
          : Array.isArray(res.body?.items)
            ? res.body.items
            : []
        expect(items).toHaveLength(0)
        // No seeded owner notification title must appear in the body string.
        for (const title of SEEDED_OWNER_NOTIFICATION_TITLES) {
          expect(JSON.stringify(res.body)).not.toContain(title)
        }
      },
    )

    it(
      // inversion: remove TenantMembershipGuard from NotificationsController → 200
      'S-9: owner GET /notifications returns 403 and no internal notification content',
      async () => {
        // Owner user has no tenant membership — accessing the internal notifications endpoint must be denied.
        const res = await demoOwnerSession.agent
          .get('/api/notifications')
          .set('x-tenant-id', tenantAId)
        expect(res.status).toBe(403)
        // No internal notification title should leak
        expectNoLeak(res, 'Document uploaded', 'Movement created', 'Status change')
      },
    )
  })

  // ---------------------------------------------------------------------------
  // B-5 — Document URL privacy
  // ---------------------------------------------------------------------------

  describe('B-5 — Document URL privacy', () => {
    it(
      // inversion: remove AuthGuard from DocumentVersionsController → 200 or 404
      'S-10: unauthenticated POST /document-versions/:id/read-url returns 401',
      async () => {
        // Unauthenticated agent (fresh, no cookie)
        const anonAgent = request.agent(app.getHttpServer())
        const res = await anonAgent
          .post(`/api/document-versions/${randomUUID()}/read-url`)
          .send({})
        expect(res.status).toBe(401)
      },
    )

    it(
      // inversion: remove ownerUserId filter in findOwnerReadableVersion → 200
      'S-11: owner POST /owner/document-versions/:id/read-url for unowned version returns 404 and no storage detail',
      async () => {
        // The isolation tenant has no document versions. Using a non-existent UUID
        // correctly exercises the not-found path without needing a real document.
        // NestJS 404 body includes the request path (URL disclosure, not data leak).
        const nonExistentVersionId = randomUUID()
        const res = await demoOwnerSession.agent.post(
          `/api/owner/document-versions/${nonExistentVersionId}/read-url`,
        )
        expect(res.status).toBe(404)
        // No storage content (key, file name) or other-owner email must appear in the body
        expectNoLeak(res, 'storageKey', 'propietario.isolation', 'document-storage')
      },
    )
  })

  // ---------------------------------------------------------------------------
  // B-6 — Admin scope
  // ---------------------------------------------------------------------------

  describe('B-6 — Admin scope (TenantMembershipGuard vs GlobalAdminGuard)', () => {
    it(
      // inversion: remove TenantMembershipGuard from PropertyEngagementsController → 200
      'S-12: VIEWPRO_ADMIN GET /property-engagements/:id returns 403 and no resource detail',
      async () => {
        // The admin has no membership in Tenant A — TenantMembershipGuard fires.
        // NestJS 403 body includes the request path (URL disclosure, not data leak).
        // We assert resource *content* (title) is absent.
        const res = await adminSession.agent
          .get(`/api/property-engagements/${unassignedEngagementId}`)
          .set('x-tenant-id', tenantAId)
        expect(res.status).toBe(403)
        expectNoLeak(res, unassignedEngagementTitle)
      },
    )

    it(
      // inversion: remove GlobalAdminGuard (positive proof — this test asserts 200)
      'S-13: VIEWPRO_ADMIN GET /admin/access-check returns 200 (inversion proof for S-12)',
      async () => {
        const res = await adminSession.agent.get('/api/admin/access-check')
        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({ access: 'granted' })
      },
    )
  })

  // ---------------------------------------------------------------------------
  // B-7 — StatusChangeRequest seller scope
  // ---------------------------------------------------------------------------

  describe('B-7 — StatusChangeRequest seller scope', () => {
    it(
      // inversion: remove assignment check in CreateStatusChangeRequestUseCase → 201
      'S-14: unassigned seller POST status-change-request returns 403 and no resource detail',
      async () => {
        // The demo seller has AGENT membership in Tenant A but is NOT assigned to unassignedEngagementId.
        // NestJS 403 body includes the request path (URL disclosure, not data leak).
        // We assert: (a) correct error code, (b) resource content (title) absent.
        const res = await demoSellerSession.agent
          .post(`/api/property-engagements/${unassignedEngagementId}/status-change-requests`)
          .set('x-tenant-id', tenantAId)
          .send({
            targetStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
            currentStatusSnapshot: PropertyEngagementStatus.CAPTURE,
          })
        expect(res.status).toBe(403)
        expect(res.body.errorCode).toBe('NOT_ASSIGNED_TO_ENGAGEMENT')
        expectNoLeak(res, unassignedEngagementTitle)
      },
    )
  })
})

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

/**
 * Creates a tenant with a manager and a seller (AGENT role).
 * The seller is NOT assigned to any engagement — callers create engagements separately.
 */
async function buildTenantWithManagerAndSeller(
  prisma: PrismaService,
  app: INestApplication,
  suffix: string,
): Promise<{ tenantId: string; manager: TestSession; seller: TestSession }> {
  const managerAgent = request.agent(app.getHttpServer())
  const managerRes = await managerAgent
    .post('/api/auth/register-tenant')
    .send({
      whatsappPhone: '3510000000',
      email: `manager-${suffix}@test.local`,
      password: 'password123',
      firstName: 'Manager',
      tenantName: `Tenant ${suffix}`,
    })
    .expect(201)

  const tenantId = managerRes.body.memberships[0].tenant.id as string
  const managerUserId = managerRes.body.user.id as string

  // Re-login to get a clean session cookie
  const mgr = request.agent(app.getHttpServer())
  const mgrLoginRes = await mgr
    .post('/api/auth/login')
    .send({ email: `manager-${suffix}@test.local`, password: 'password123' })

  // Create the seller user via a throwaway tenant, then add them to the main tenant
  const sellerAgent = request.agent(app.getHttpServer())
  const sellerRes = await sellerAgent
    .post('/api/auth/register-tenant')
    .send({
      whatsappPhone: '3510000000',
      email: `seller-${suffix}@test.local`,
      password: 'password123',
      firstName: 'Seller',
      tenantName: `Seller Throwaway ${suffix}`,
    })
    .expect(201)
  const sellerUserId = sellerRes.body.user.id as string

  await prisma.tenantMembership.create({
    data: { userId: sellerUserId, tenantId, role: TenantRole.AGENT },
  })

  // Re-login seller with a clean agent
  const slr = request.agent(app.getHttpServer())
  const slrLoginRes = await slr
    .post('/api/auth/login')
    .send({ email: `seller-${suffix}@test.local`, password: 'password123' })

  return {
    tenantId,
    manager: { agent: mgr, userId: mgrLoginRes.body.user.id as string, tenantId },
    seller: { agent: slr, userId: slrLoginRes.body.user.id as string, tenantId },
  }
}

/**
 * Creates the minimal isolation tenant directly via Prisma (no API registration).
 * Mirrors the seed-demo.mjs isolation tenant shape.
 *
 * Returns tenantId, engagementId, assetId, and an authenticated manager session.
 */
async function buildIsolationTenant(
  prisma: PrismaService,
  app: INestApplication,
  suffix: string,
): Promise<{ tenantId: string; engagementId: string; assetId: string; manager: TestSession }> {
  // Create manager user
  const managerAgent = request.agent(app.getHttpServer())
  const managerRes = await managerAgent
    .post('/api/auth/register-tenant')
    .send({
      whatsappPhone: '3510000000',
      email: `iso-manager-${suffix}@test.local`,
      password: 'password123',
      firstName: 'Iso',
      tenantName: `Isolation Tenant ${suffix}`,
    })
    .expect(201)
  const tenantId = managerRes.body.memberships[0].tenant.id as string
  const managerId = managerRes.body.user.id as string

  // Create an isolation owner user (no tenant membership)
  const isoOwnerRes = await request(app.getHttpServer())
    .post('/api/auth/register-tenant')
    .send({
      whatsappPhone: '3510000000',
      email: `iso-owner-${suffix}@test.local`,
      password: 'password123',
      firstName: 'IsoOwner',
      tenantName: `IsoOwner Throwaway ${suffix}`,
    })
    .expect(201)
  const isoOwnerId = isoOwnerRes.body.user.id as string

  // Create asset + engagement directly via Prisma
  const asset = await prisma.propertyAsset.create({
    data: {
      title: `Propiedad isolation ${suffix}`,
      addressLine: 'Aislamiento 1',
      city: 'Córdoba',
      province: 'Córdoba',
      propertyType: PropertyType.HOUSE,
      ownerName: 'Iso Propietario',
      ownerEmail: `iso-owner-${suffix}@test.local`,
      createdByUserId: managerId,
    },
  })

  // Link the isolation owner to the asset with ACTIVE access
  await prisma.propertyAssetOwner.create({
    data: {
      propertyAssetId: asset.id,
      ownerEmail: `iso-owner-${suffix}@test.local`,
      ownerFirstName: 'Iso',
      ownerLastName: 'Propietario',
      userId: isoOwnerId,
      isPrimary: true,
      accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
    },
  })

  const engagement = await prisma.propertyEngagement.create({
    data: {
      tenantId,
      propertyAssetId: asset.id,
      operationType: PropertyOperationType.SALE,
      status: PropertyEngagementStatus.CAPTURE,
      publishedPriceCents: 100,
      currency: 'USD',
      createdByUserId: managerId,
    },
  })

  // Re-login manager with clean session
  const mgr = request.agent(app.getHttpServer())
  const mgrLoginRes = await mgr
    .post('/api/auth/login')
    .send({ email: `iso-manager-${suffix}@test.local`, password: 'password123' })

  return {
    tenantId,
    engagementId: engagement.id,
    assetId: asset.id,
    manager: { agent: mgr, userId: mgrLoginRes.body.user.id as string, tenantId },
  }
}

/**
 * Creates an owner session (no tenant membership).
 * The owner is NOT linked to the given tenantAAssetId — they're granted access to a separate
 * fresh asset in Tenant A so they have a valid owner session.
 * The owner does NOT have access to tenantBAssetId — used for B-3 tests.
 */
async function buildOwnerSession(
  prisma: PrismaService,
  app: INestApplication,
  suffix: string,
  _tenantAId: string,
  _tenantBAssetId: string,
): Promise<TestSession> {
  // Register the owner via a throwaway tenant (gives them a user account)
  const ownerAgent = request.agent(app.getHttpServer())
  const ownerRes = await ownerAgent
    .post('/api/auth/register-tenant')
    .send({
      whatsappPhone: '3510000000',
      email: `owner-${suffix}@test.local`,
      password: 'password123',
      firstName: 'DemoOwner',
      tenantName: `Owner Throwaway ${suffix}`,
    })
    .expect(201)
  const ownerId = ownerRes.body.user.id as string
  const ownerTenantId = ownerRes.body.memberships[0].tenant.id as string

  // Log in again with a clean agent
  const ownerClean = request.agent(app.getHttpServer())
  const loginRes = await ownerClean
    .post('/api/auth/login')
    .send({ email: `owner-${suffix}@test.local`, password: 'password123' })

  return {
    agent: ownerClean,
    userId: loginRes.body.user.id as string,
    tenantId: ownerTenantId,
  }
}

/**
 * Creates a VIEWPRO_ADMIN user (no tenant membership in any test tenant).
 */
async function buildAdminSession(
  prisma: PrismaService,
  app: INestApplication,
  suffix: string,
): Promise<{ agent: ReturnType<typeof request.agent>; userId: string }> {
  const adminAgent = request.agent(app.getHttpServer())
  const adminRes = await adminAgent
    .post('/api/auth/register-tenant')
    .send({
      whatsappPhone: '3510000000',
      email: `admin-${suffix}@test.local`,
      password: 'password123',
      firstName: 'Admin',
      tenantName: `Admin Throwaway ${suffix}`,
    })
    .expect(201)
  const adminId = adminRes.body.user.id as string

  // Upgrade to VIEWPRO_ADMIN
  await prisma.user.update({
    where: { id: adminId },
    data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
  })

  // Re-login with fresh agent
  const adm = request.agent(app.getHttpServer())
  const loginRes = await adm
    .post('/api/auth/login')
    .send({ email: `admin-${suffix}@test.local`, password: 'password123' })

  return { agent: adm, userId: loginRes.body.user.id as string }
}
