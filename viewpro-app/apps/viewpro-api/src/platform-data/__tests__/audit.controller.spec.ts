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
import { AuditController } from '../audit.controller'
import { AuditService } from '../audit.service'

/**
 * T-18 — RED: `AuditController`/`AuditService` tests — pagination, auth,
 * isolation (A9/A10).
 *
 * Spec: platform-audit-log — Operator Audit Feed Endpoint (all 5 scenarios)
 */

const TEST_EMAIL = 'audit-ctrl-test@viewpro.app'
const TEST_PASSWORD = 'audit-ctrl-test-password'

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('AuditController (integration — test DB)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: TEST_EMAIL,
        SEED_OPERATOR_PASSWORD: TEST_PASSWORD,
      },
    })

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
      ],
      controllers: [AuditController],
      providers: [AuditService],
    }).compile()

    app = moduleFixture.createNestApplication()
    app.use(cookieParser())
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()

    prisma = moduleFixture.get(PrismaService)
  })

  afterAll(async () => {
    await app?.close()
  })

  beforeEach(async () => {
    await prisma.platformAuditLog.deleteMany()
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
        previousValue: null,
        newValue: null,
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
        previousValue: null,
        newValue: null,
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

  // Endpoint accepts NO tenantId query param — passing one has no filtering effect (Q3, global-only)
  it('?tenantId=<x> has no filtering effect — endpoint stays global-only (Q3)', async () => {
    await seedThreeAuditRows()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/audit?tenantId=t-1')
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
})
