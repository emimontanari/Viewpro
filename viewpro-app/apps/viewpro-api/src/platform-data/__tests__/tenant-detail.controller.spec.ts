import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { Test, TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { AuthModule } from '../../auth/auth.module'
import { PrismaService } from '../../database/prisma.service'
import { PermissionsModule } from '../../permissions/permissions.module'
import { TenantDetailController } from '../tenant-detail.controller'
import { TenantDetailService } from '../tenant-detail.service'
import { ChangeFeedClient, DocumentReadUrlFetchError, TenantSummaryFetchError } from '../change-feed.client'
import { AuditLogRepository } from '../audit-log.repository'
import { seedOperatorFixture } from '../../test-support/operator.fixture'

/**
 * platform-tenant-tracking (PR1) — RED: `TenantDetailController`/
 * `TenantDetailService` tests — permission gating + InmoView passthrough +
 * error mapping.
 *
 * Spec: platform-tenant-tracking — "ViewPro tenant summary passthrough"
 * Design D8: gated by AuthGuard + PlatformPermissionGuard(TENANTS_READ),
 *   InmoView 404 -> 404, everything else (non-2xx or unreachable) -> 502.
 *
 * ChangeFeedClient is mocked — no live InmoView HTTP call in this test
 * harness (mirrors backfill.spec.ts's `makeMockChangeFeedClient` pattern).
 */

const TEST_EMAIL = 'tenant-detail-test@viewpro.app'
const TEST_PASSWORD = 'tenant-detail-test-password'
// Second operator used only for the 403 PERMISSION_DENIED coverage. Every
// active platform role (ANALYST/OPERATIONS/OWNER) grants TENANTS_READ, so the
// only reachable PERMISSION_DENIED path for this route is a non-ACTIVE
// operator: the guard resolves role/status via a fresh per-request DB lookup
// (D1), while AuthGuard only validates the JWT — so logging in while ACTIVE and
// then suspending yields a request whose effective permission is denied.
const TEST_EMAIL_DENIED = 'tenant-detail-denied@viewpro.app'
const TEST_PASSWORD_DENIED = 'tenant-detail-denied-password'

const mockSummary = {
  window: { from: '2026-05-18T00:00:00.000Z', to: '2026-05-25T00:00:00.000Z' },
  activeEngagements: 2,
  activeEngagementsWithOwnerVisibleUpdate: 1,
  activeEngagementUpdatePercentage: 50,
  documentEvents: { requested: 1, uploaded: 0, approved: 0, rejected: 0 },
  ownerViewedPropertyCount: 3,
  activity: {
    total: 1,
    items: [{ kind: 'movement' as const, id: 'movement-1', createdAt: '2026-05-22T10:00:00.000Z' }],
  },
}

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('TenantDetailController (integration — test DB, mocked InmoView client)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockFetchTenantSummary: ReturnType<typeof vi.fn<ChangeFeedClient['fetchTenantSummary']>>

  beforeAll(async () => {
    mockFetchTenantSummary = vi.fn()
    const mockChangeFeedClient: Pick<ChangeFeedClient, 'fetchTenantSummary'> = {
      fetchTenantSummary: mockFetchTenantSummary,
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
      ],
      controllers: [TenantDetailController],
      providers: [
        TenantDetailService,
        AuditLogRepository,
        { provide: ChangeFeedClient, useValue: mockChangeFeedClient },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.listen(0)

    prisma = moduleFixture.get(PrismaService)
    await seedOperatorFixture(app, { email: TEST_EMAIL, password: TEST_PASSWORD })
    await seedOperatorFixture(app, { email: TEST_EMAIL_DENIED, password: TEST_PASSWORD_DENIED })
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(() => {
    mockFetchTenantSummary.mockClear()
  })

  async function getSessionCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractPlatformCookie(res.headers as Record<string, unknown>)
  }

  // Scenario: Authorized operator gets the summary
  it('operator with TENANTS_READ → 200 passthrough of the mocked InmoView summary', async () => {
    mockFetchTenantSummary.mockResolvedValueOnce(mockSummary)
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(mockSummary)
    expect(mockFetchTenantSummary).toHaveBeenCalledWith('tenant-1', 0, 20)
  })

  it('forwards offset/limit query params to the InmoView client', async () => {
    mockFetchTenantSummary.mockResolvedValueOnce(mockSummary)
    const cookie = await getSessionCookie()

    await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary?offset=10&limit=5')
      .set('Cookie', cookie)
      .expect(200)

    expect(mockFetchTenantSummary).toHaveBeenCalledWith('tenant-1', 10, 5)
  })

  // JD FIX 2: the passthrough must cap the forwarded limit at 100 so a huge
  // limit cannot drive an unbounded query on the InmoView side (defense in
  // depth — the cap holds even if the InmoView route were bypassed).
  it('clamps an over-max limit down to 100 before forwarding to InmoView', async () => {
    mockFetchTenantSummary.mockResolvedValueOnce(mockSummary)
    const cookie = await getSessionCookie()

    await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary?offset=0&limit=100000000')
      .set('Cookie', cookie)
      .expect(200)

    expect(mockFetchTenantSummary).toHaveBeenCalledWith('tenant-1', 0, 100)
  })

  // Scenario: Unauthenticated request is rejected
  it('GET /api/operators/tenants/:id/summary without a session → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/operators/tenants/tenant-1/summary')

    expect(res.status).toBe(401)
    expect(mockFetchTenantSummary).not.toHaveBeenCalled()
  })

  // Scenario: Authenticated operator lacking effective TENANTS_READ → 403.
  // The route is guarded by PlatformPermissionGuard(TENANTS_READ); a non-ACTIVE
  // operator is denied with PERMISSION_DENIED and never reaches the passthrough.
  it('authenticated operator without effective TENANTS_READ → 403 PERMISSION_DENIED, no passthrough', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL_DENIED, password: TEST_PASSWORD_DENIED })
    expect(loginRes.status).toBe(200)
    const cookie = extractPlatformCookie(loginRes.headers as Record<string, unknown>)

    // Revoke access AFTER login: the guard's fresh per-request lookup now
    // resolves a non-ACTIVE operator and denies the request.
    await prisma.operator.update({
      where: { email: TEST_EMAIL_DENIED },
      data: { status: 'SUSPENDED' },
    })

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('PERMISSION_DENIED')
    expect(mockFetchTenantSummary).not.toHaveBeenCalled()
  })

  // Scenario: InmoView 404 → ViewPro 404
  it('InmoView returns 404 for the tenant → ViewPro returns 404', async () => {
    mockFetchTenantSummary.mockRejectedValueOnce(
      new TenantSummaryFetchError('Tenant-summary endpoint returned non-2xx status: 404', 404),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/does-not-exist/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })

  // Scenario: InmoView unreachable or erroring → ViewPro 502
  it('InmoView is unreachable (network failure) → ViewPro returns 502', async () => {
    mockFetchTenantSummary.mockRejectedValueOnce(
      new TenantSummaryFetchError('Tenant-summary request to InmoView failed: fetch failed'),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(502)
  })

  it('InmoView returns a non-404 error status (e.g. 500) → ViewPro returns 502', async () => {
    mockFetchTenantSummary.mockRejectedValueOnce(
      new TenantSummaryFetchError('Tenant-summary endpoint returned non-2xx status: 500', 500),
    )
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/summary')
      .set('Cookie', cookie)

    expect(res.status).toBe(502)
  })

  // Read-only passthrough invariant: no ViewPro table is ever written by this route.
  it('does not persist the InmoView response in any ViewPro table (structural: no prisma writes in TenantDetailService)', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(__dirname, '..', 'tenant-detail.service.ts'), 'utf8')

    expect(source).not.toMatch(/prisma\.\w+\.(create|update|upsert|delete)/)
  })
})

// ---------------------------------------------------------------------------
// operator-activity-media (Slice 2b, D4) — RED→GREEN: GET
// /operators/tenants/:tenantId/document-versions/:versionId/read-url with
// REAL permission enforcement (no guard override).
//
// Spec: operator-document-read — Permission-Gated Signed Read URL, Audit
//   Entry on Every Successful Mint, Audit write fails.
// Design D4/D7: TENANT_DOCUMENTS_READ is now seeded (role-permissions.ts) —
//   OWNER inherits it, ANALYST is excluded. This block SUPERSEDES Slice 2a's
//   `.overrideGuard(PlatformPermissionGuard)` version: the real
//   PlatformPermissionGuard now runs, so both the "holds the permission"
//   success path AND the "lacks the permission" 403 path are exercised
//   end-to-end against the real guard + role lookup (mirrors the existing
//   TENANTS_READ SUSPENDED-operator 403 pattern above — role resolution is a
//   fresh per-request DB lookup, D1, so downgrading a role AFTER login still
//   takes effect on the next request).
// ChangeFeedClient is mocked (no live InmoView call); AuditLogRepository is
//   the REAL class against the test DB, so audit rows are asserted directly.
// ---------------------------------------------------------------------------

describe('TenantDetailController.documentReadUrl (integration — test DB, mocked InmoView client, real permission guard — Slice 2b)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let mockFetchDocumentReadUrl: ReturnType<typeof vi.fn<ChangeFeedClient['fetchDocumentReadUrl']>>

  // Default seeded operator role is OWNER (prisma/seed.ts) — inherits
  // TENANT_DOCUMENTS_READ via OPERATIONS_PERMISSIONS, so this operator can
  // exercise every success path below.
  const DOC_TEST_EMAIL = 'document-read-url-test@viewpro.app'
  const DOC_TEST_PASSWORD = 'document-read-url-test-password'
  // Seeded as OWNER, then downgraded to ANALYST — the one role that does NOT
  // hold TENANT_DOCUMENTS_READ (least-privilege exclusion, D4).
  const DOC_DENIED_EMAIL = 'document-read-url-denied@viewpro.app'
  const DOC_DENIED_PASSWORD = 'document-read-url-denied-password'

  beforeAll(async () => {
    mockFetchDocumentReadUrl = vi.fn()
    const mockChangeFeedClient: Pick<ChangeFeedClient, 'fetchDocumentReadUrl'> = {
      fetchDocumentReadUrl: mockFetchDocumentReadUrl,
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
      ],
      controllers: [TenantDetailController],
      providers: [
        TenantDetailService,
        AuditLogRepository,
        { provide: ChangeFeedClient, useValue: mockChangeFeedClient },
      ],
      // NO overrideGuard here (Slice 2b): the real PlatformPermissionGuard
      // + real role-permission seeding are exercised end-to-end.
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.listen(0)

    prisma = moduleFixture.get(PrismaService)
    await seedOperatorFixture(app, { email: DOC_TEST_EMAIL, password: DOC_TEST_PASSWORD })
    await seedOperatorFixture(app, { email: DOC_DENIED_EMAIL, password: DOC_DENIED_PASSWORD })
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    mockFetchDocumentReadUrl.mockClear()
    await prisma.platformAuditLog.deleteMany()
  })

  async function getDocCookie(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: DOC_TEST_EMAIL, password: DOC_TEST_PASSWORD })
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractPlatformCookie(res.headers as Record<string, unknown>)
  }

  const mintedResult = {
    url: 'https://storage.example/read/documents/req-1/version-1.pdf',
    expiresInSeconds: 300,
    originalFilename: 'deed.pdf',
    mimeType: 'application/pdf',
  }

  it('operator holding TENANT_DOCUMENTS_READ (OWNER) → 200 with the minted URL, AND exactly one TENANT_DOCUMENT_VIEWED audit row is persisted', async () => {
    mockFetchDocumentReadUrl.mockResolvedValueOnce(mintedResult)
    const cookie = await getDocCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/document-versions/version-1/read-url')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body).toEqual(mintedResult)

    const rows = await prisma.platformAuditLog.findMany({ where: { action: 'TENANT_DOCUMENT_VIEWED' } })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.tenantId).toBe('tenant-1')
    expect(rows[0]?.target).toEqual({ documentVersionId: 'version-1', filename: 'deed.pdf' })
  })

  // Scenario: operator lacking TENANT_DOCUMENTS_READ (ANALYST, downgraded
  // AFTER login — the guard's fresh per-request lookup denies the very next
  // request, same pattern as the TENANTS_READ SUSPENDED-operator test above).
  it('operator lacking TENANT_DOCUMENTS_READ (ANALYST) → 403 PERMISSION_DENIED, no mint, no audit row', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: DOC_DENIED_EMAIL, password: DOC_DENIED_PASSWORD })
    expect(loginRes.status).toBe(200)
    const cookie = extractPlatformCookie(loginRes.headers as Record<string, unknown>)

    await prisma.operator.update({
      where: { email: DOC_DENIED_EMAIL },
      data: { role: 'ANALYST' },
    })

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/document-versions/version-1/read-url')
      .set('Cookie', cookie)

    expect(res.status).toBe(403)
    expect(res.body.code).toBe('PERMISSION_DENIED')
    expect(mockFetchDocumentReadUrl).not.toHaveBeenCalled()
    const rows = await prisma.platformAuditLog.findMany({ where: { action: 'TENANT_DOCUMENT_VIEWED' } })
    expect(rows).toHaveLength(0)
  })

  it('unauthenticated request → 401, no mint attempted, no audit row', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/operators/tenants/tenant-1/document-versions/version-1/read-url',
    )

    expect(res.status).toBe(401)
    expect(mockFetchDocumentReadUrl).not.toHaveBeenCalled()
    const rows = await prisma.platformAuditLog.findMany({ where: { action: 'TENANT_DOCUMENT_VIEWED' } })
    expect(rows).toHaveLength(0)
  })

  it('cross-tenant/missing version (InmoView 404) → ViewPro 404, no audit row', async () => {
    mockFetchDocumentReadUrl.mockRejectedValueOnce(new DocumentReadUrlFetchError('not found', 404))
    const cookie = await getDocCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/document-versions/does-not-exist/read-url')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
    const rows = await prisma.platformAuditLog.findMany({ where: { action: 'TENANT_DOCUMENT_VIEWED' } })
    expect(rows).toHaveLength(0)
  })

  it('InmoView unreachable → ViewPro 502, no audit row', async () => {
    mockFetchDocumentReadUrl.mockRejectedValueOnce(new DocumentReadUrlFetchError('network down'))
    const cookie = await getDocCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants/tenant-1/document-versions/version-1/read-url')
      .set('Cookie', cookie)

    expect(res.status).toBe(502)
    const rows = await prisma.platformAuditLog.findMany({ where: { action: 'TENANT_DOCUMENT_VIEWED' } })
    expect(rows).toHaveLength(0)
  })
})
