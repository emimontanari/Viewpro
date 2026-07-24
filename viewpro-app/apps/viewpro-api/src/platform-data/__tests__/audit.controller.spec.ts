import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { execSync } from 'node:child_process'
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
import { AuditController, sanitizeDate, sanitizeSource, sanitizeTrimmedFilter } from '../audit.controller'
import { AuditService } from '../audit.service'
import { PlatformTenantRepository } from '../platform-tenant.repository'

/**
 * T-18 — RED: `AuditController`/`AuditService` tests — pagination, auth,
 * isolation (A9/A10).
 *
 * Spec: platform-audit-log — Operator Audit Feed Endpoint (all 5 scenarios)
 */

/**
 * audit-view (Slice 2, Phase 2) — RED: plain unit tests for the controller's
 * filter-param sanitizers (design D6, testing strategy: "Plain unit test on
 * exported functions"). Deliberately a SIBLING top-level `describe` (no
 * `beforeAll`/DB dependency) so these run and pass without Postgres, unlike
 * the integration suite below.
 *
 * Spec: Server-side audit filters — Scenario: Malformed filter value
 * degrades, not errors.
 */
describe('audit.controller sanitizers (plain unit tests, no DB)', () => {
  describe('sanitizeTrimmedFilter (action/tenantId/actorId, design D6)', () => {
    it('undefined → undefined', () => {
      expect(sanitizeTrimmedFilter(undefined)).toBeUndefined()
    })

    it('empty string → undefined', () => {
      expect(sanitizeTrimmedFilter('')).toBeUndefined()
    })

    it('whitespace-only → undefined', () => {
      expect(sanitizeTrimmedFilter('   ')).toBeUndefined()
    })

    it('trims surrounding whitespace and passes the value through', () => {
      expect(sanitizeTrimmedFilter('  OPERATOR_ROLE_CHANGED  ')).toBe('OPERATOR_ROLE_CHANGED')
    })

    it('a syntactically valid but non-catalog value is NOT rejected (no allowlist, design D6) — passes through as a literal filter value', () => {
      expect(sanitizeTrimmedFilter('NOT_A_REAL_ACTION')).toBe('NOT_A_REAL_ACTION')
    })
  })

  describe('sanitizeSource (allowlisted, design D6)', () => {
    it('undefined → undefined', () => {
      expect(sanitizeSource(undefined)).toBeUndefined()
    })

    it('INMOVIEW_OUTBOX → passthrough', () => {
      expect(sanitizeSource('INMOVIEW_OUTBOX')).toBe('INMOVIEW_OUTBOX')
    })

    it('VIEWPRO_NATIVE → passthrough', () => {
      expect(sanitizeSource('VIEWPRO_NATIVE')).toBe('VIEWPRO_NATIVE')
    })

    it('unrecognized value → undefined (never 400)', () => {
      expect(sanitizeSource('NOT_A_REAL_SOURCE')).toBeUndefined()
    })

    it('empty string → undefined', () => {
      expect(sanitizeSource('')).toBeUndefined()
    })
  })

  describe('sanitizeDate (design D6)', () => {
    it('undefined → undefined', () => {
      expect(sanitizeDate(undefined)).toBeUndefined()
    })

    it('valid ISO date string → parsed Date', () => {
      const result = sanitizeDate('2026-01-01')
      expect(result).toBeInstanceOf(Date)
      expect(result?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    })

    it('valid full ISO datetime string → parsed Date', () => {
      const result = sanitizeDate('2026-06-30T23:59:59.999Z')
      expect(result?.toISOString()).toBe('2026-06-30T23:59:59.999Z')
    })

    it('non-ISO / unparseable string → undefined, never throws (Scenario: malformed filter degrades)', () => {
      expect(sanitizeDate('not-a-date')).toBeUndefined()
    })

    it('empty string → undefined', () => {
      expect(sanitizeDate('')).toBeUndefined()
    })
  })
})

const TEST_EMAIL = 'audit-ctrl-test@viewpro.app'
const TEST_PASSWORD = 'audit-ctrl-test-password'

// T-09 — role fixtures for PlatformPermissionGuard READ-route coverage.
const TEST_EMAIL_ANALYST = 'audit-ctrl-test-analyst@viewpro.app'
const TEST_PASSWORD_ANALYST = 'audit-ctrl-test-analyst-password'
const TEST_EMAIL_OPERATIONS = 'audit-ctrl-test-operations@viewpro.app'
const TEST_PASSWORD_OPERATIONS = 'audit-ctrl-test-operations-password'

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('AuditController (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService

  function seedOperator(email: string, password: string): void {
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: email,
        SEED_OPERATOR_PASSWORD: password,
      },
    })
  }

  beforeAll(async () => {
    seedOperator(TEST_EMAIL, TEST_PASSWORD)

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
        PermissionsModule,
      ],
      controllers: [AuditController],
      // audit-view (Slice 1, Phase 1): AuditService now also depends on
      // PlatformTenantRepository (batch tenant name resolution, D1/D2) —
      // OPERATOR_REPOSITORY is already exported by PermissionsModule above,
      // but PlatformTenantRepository has no module import path here and must
      // be provided directly (same DI-wiring lesson as audit.service.spec.ts).
      providers: [AuditService, PlatformTenantRepository],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = moduleFixture.get(PrismaService)

    // T-09 — role fixtures seeded directly via Prisma (no real signup exists).
    seedOperator(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)
    await prisma.operator.update({ where: { email: TEST_EMAIL_ANALYST }, data: { role: 'ANALYST' } })

    seedOperator(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)
    await prisma.operator.update({ where: { email: TEST_EMAIL_OPERATIONS }, data: { role: 'OPERATIONS' } })
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
  })

  async function getSessionCookieFor(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
    if (res.status !== 200) {
      throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`)
    }
    return extractPlatformCookie(res.headers as Record<string, unknown>)
  }

  async function getSessionCookie(): Promise<string> {
    return getSessionCookieFor(TEST_EMAIL, TEST_PASSWORD)
  }

  async function seedThreeAuditRows() {
    await prisma.platformAuditLog.createMany({
      data: [
        {
          sourceEventId: 'evt-audit-seed-1',
          seqNo: 1,
          action: 'TENANT_STATUS_CHANGED',
          tenantId: 't-1',
          actor: { id: 'op-1', type: 'operator', label: 'op-1' },
          previousValue: { status: 'TRIAL' },
          newValue: { status: 'ACTIVE' },
          occurredAt: new Date(Date.now() - 3000),
        },
        {
          sourceEventId: 'evt-audit-seed-2',
          seqNo: 2,
          action: 'TENANT_LIMITS_UPDATED',
          tenantId: 't-2',
          actor: { id: 'op-2', type: 'operator', label: 'op-2' },
          previousValue: { maxUsers: 5 },
          newValue: { maxUsers: 10 },
          occurredAt: new Date(Date.now() - 2000),
        },
        {
          sourceEventId: 'evt-audit-seed-3',
          seqNo: 3,
          action: 'TENANT_STATUS_CHANGED',
          tenantId: 't-3',
          actor: { id: 'usr-1', type: 'user', label: 'usr-1' },
          previousValue: { status: 'ACTIVE' },
          newValue: { status: 'SUSPENDED' },
          occurredAt: new Date(Date.now() - 1000),
        },
      ],
    })
  }

  // Scenario: Authenticated operator + 3 seeded rows → 200 + items ordered seqNo DESC
  it('GET /api/operators/audit with valid session → 200 + items ordered seqNo DESC with full shape', async () => {
    await seedThreeAuditRows()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items.map((i: { seqNo: number }) => i.seqNo)).toEqual([3, 2, 1])
    expect(res.body.items[0]).toMatchObject({
      id: expect.any(String),
      action: 'TENANT_STATUS_CHANGED',
      tenantId: 't-3',
      actor: { id: 'usr-1', type: 'user', label: 'usr-1' },
      previousValue: { status: 'ACTIVE' },
      newValue: { status: 'SUSPENDED' },
      occurredAt: expect.any(String),
      seqNo: 3,
    })
  })

  // No limit query param → at most 50 items returned (default)
  it('no limit query param → at most 50 items returned (default)', async () => {
    await prisma.platformAuditLog.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        sourceEventId: `evt-audit-default-${i}`,
        seqNo: i + 1,
        action: 'TENANT_STATUS_CHANGED',
        tenantId: `t-${i}`,
        actor: { id: 'op-1', type: 'operator', label: 'op-1' },
        occurredAt: new Date(),
      })),
    })
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(60)
    expect(res.body.items).toHaveLength(50)
  })

  // ?limit=1000 → capped at 200 (A9)
  it('?limit=1000 → capped at 200 items', async () => {
    await prisma.platformAuditLog.createMany({
      data: Array.from({ length: 202 }, (_, i) => ({
        sourceEventId: `evt-audit-cap-${i}`,
        seqNo: i + 1,
        action: 'TENANT_STATUS_CHANGED',
        tenantId: `t-${i}`,
        actor: { id: 'op-1', type: 'operator', label: 'op-1' },
        occurredAt: new Date(),
      })),
    })
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit?limit=1000')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(202)
    expect(res.body.items).toHaveLength(200)
  })

  // No viewpro_platform_access_token cookie → 401 (spec: unauthenticated rejected)
  it('GET /api/operators/audit without token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/operators/audit')

    expect(res.status).toBe(401)
  })

  // audit-view (Slice 2, Phase 2), task 2.8 — regression guard: adding
  // filter query params must NOT bypass AUDIT_READ gating. A request without
  // a valid session is denied exactly as before this change, under any
  // filter combination (Scenario: Missing permission).
  it('GET /api/operators/audit without token → 401 even with a full filter combo applied (Scenario: missing permission)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/operators/audit?action=OPERATOR_SUSPENDED&source=INMOVIEW_OUTBOX&tenantId=t-1&actorId=op-1&dateFrom=2026-01-01&dateTo=2026-06-30',
    )

    expect(res.status).toBe(401)
  })

  // Empty platform_audit_log → 200 + { total: 0, items: [] }
  it('GET /api/operators/audit with empty platform_audit_log → 200 + total 0, items []', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.items).toEqual([])
  })

  // audit-view (Slice 2, Phase 2), design D14: supersedes the Q3 "global-only"
  // restriction — `?tenantId=<x>` now filters end-to-end, HTTP → controller
  // sanitizer → AuditService where-clause.
  it('?tenantId=<x> filters end-to-end — only that tenant\'s rows are returned (design D14 supersedes former Q3)', async () => {
    await seedThreeAuditRows()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit?tenantId=t-1')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].tenantId).toBe('t-1')
  })

  // End-to-end action filter through the real HTTP layer (task 2.2/2.7 wiring proof).
  it('?action=<x> filters end-to-end via HTTP', async () => {
    await seedThreeAuditRows()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit?action=TENANT_LIMITS_UPDATED')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].action).toBe('TENANT_LIMITS_UPDATED')
  })

  // Malformed filter values degrade silently — no 400, matches Slice 1's
  // established param-sanitizing convention (design D6).
  it('malformed filter query params degrade instead of erroring — 200, unfiltered result (Scenario: malformed filter degrades)', async () => {
    await seedThreeAuditRows()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit?source=NOT_A_REAL_SOURCE&dateFrom=not-a-date')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items).toHaveLength(3)
  })

  // Isolation invariant (structural): AuditService imports no @prisma/client
  // (InmoView's client) — only its own generated client (src/generated/prisma).
  it('AuditService imports no @prisma/client — only the viewpro-api generated client', () => {
    const serviceSourcePath = join(__dirname, '..', 'audit.service.ts')
    const source = readFileSync(serviceSourcePath, 'utf8')

    expect(source).not.toContain("from '@prisma/client'")
  })

  // Isolation invariant (DI/structural): ChangeFeedClient (InmoView HTTP touchpoint) is
  // absent from the operator audit-feed module wiring — proves GET /operators/audit
  // never reads InmoView's DB, even if it were unreachable.
  it('ChangeFeedClient is not resolvable in the audit-feed module wiring (zero InmoView DB reads)', async () => {
    let changeFeedClientResolved: boolean
    try {
      const { ChangeFeedClient } = await import('../change-feed.client.js')
      app.get(ChangeFeedClient)
      changeFeedClientResolved = true
    } catch {
      changeFeedClientResolved = false
    }
    expect(changeFeedClientResolved).toBe(false)
  })

  // -------------------------------------------------------------------------
  // T-09 — RED: PlatformPermissionGuard READ-route coverage (AC3 READ half)
  //
  // Spec: operator-platform-roles — Read Routes Require the Declared READ
  //   Permission
  // -------------------------------------------------------------------------
  it('ANALYST session → GET /api/operators/audit → 200', async () => {
    const cookie = await getSessionCookieFor(TEST_EMAIL_ANALYST, TEST_PASSWORD_ANALYST)

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
  })

  it('OPERATIONS session → GET /api/operators/audit → 200', async () => {
    const cookie = await getSessionCookieFor(TEST_EMAIL_OPERATIONS, TEST_PASSWORD_OPERATIONS)

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
  })
})
