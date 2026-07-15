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
import { TenantRegistryController } from '../tenant-registry.controller'
import { TenantRegistryService } from '../tenant-registry.service'

/**
 * T-16 — RED: `TenantRegistryController` tests — pagination, auth, isolation (A10/A11).
 *
 * Spec: tenant-registry — Operator Tenant List Endpoint (all 4 scenarios); isolation invariant
 */

const TEST_EMAIL = 'tenant-registry-test@viewpro.app'
const TEST_PASSWORD = 'tenant-registry-test-password'

function extractPlatformCookie(headers: Record<string, unknown>): string {
  const raw = headers['set-cookie'] as string[] | string | undefined
  const arr = Array.isArray(raw) ? raw : [raw ?? '']
  const found = arr.find((c) => c.includes('viewpro_platform_access_token=')) ?? ''
  return (found.split(';')[0] ?? '').trim()
}

describe('TenantRegistryController (integration — test DB)', () => {
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
      controllers: [TenantRegistryController],
      providers: [TenantRegistryService],
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
    await prisma.platformTenant.deleteMany()
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

  async function seedThreeTenants() {
    await prisma.platformTenant.createMany({
      data: [
        {
          id: 't-bravo',
          name: 'Bravo Realty',
          slug: 'bravo-realty',
          latestStatus: 'ACTIVE',
          maxUsers: 5,
          maxActivePropertyEngagements: 10,
          maxDocumentsStorageMb: 500,
        },
        {
          id: 't-alpha',
          name: 'Alpha Realty',
          slug: 'alpha-realty',
          latestStatus: 'TRIAL',
          maxUsers: 3,
          maxActivePropertyEngagements: 5,
          maxDocumentsStorageMb: 200,
        },
        {
          id: 't-charlie',
          name: 'Charlie Realty',
          slug: 'charlie-realty',
          latestStatus: 'SUSPENDED',
          maxUsers: null,
          maxActivePropertyEngagements: null,
          maxDocumentsStorageMb: null,
        },
      ],
    })
  }

  // Scenario: Authenticated operator receives paginated tenant list
  it('GET /api/operators/tenants with valid session → 200 + total/items sorted by name ASC', async () => {
    await seedThreeTenants()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items.map((t: { name: string }) => t.name)).toEqual([
      'Alpha Realty',
      'Bravo Realty',
      'Charlie Realty',
    ])
    expect(res.body.items[0]).toMatchObject({
      id: 't-alpha',
      name: 'Alpha Realty',
      slug: 'alpha-realty',
      status: 'TRIAL',
      limits: { maxUsers: 3, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 200 },
    })
  })

  // Pagination: offset/limit still reflects the full total
  it('?offset=1&limit=1 → total reflects full count; items has 1 entry (second alphabetically)', async () => {
    await seedThreeTenants()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?offset=1&limit=1')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Bravo Realty')
  })

  // A11: limit is capped at 200 — proven with a real over-cap seed
  it('?limit=201 → capped at 200 items', async () => {
    await prisma.platformTenant.createMany({
      data: Array.from({ length: 202 }, (_, i) => ({
        id: `cap-tenant-${String(i).padStart(3, '0')}`,
        name: `Cap Tenant ${String(i).padStart(3, '0')}`,
        slug: `cap-tenant-${i}`,
        latestStatus: 'ACTIVE',
      })),
    })
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?limit=201')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(202)
    expect(res.body.items).toHaveLength(200)
  })

  // Malformed pagination params must degrade gracefully to defaults (never 500).
  it('?offset=abc → 200 with a valid page (offset defaults to 0), not 500', async () => {
    await seedThreeTenants()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?offset=abc')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items).toHaveLength(3)
    expect(res.body.items[0].name).toBe('Alpha Realty')
  })

  it('?offset=-1 → 200 with a valid page (negative offset defaults to 0), not 500', async () => {
    await seedThreeTenants()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?offset=-1')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items).toHaveLength(3)
    expect(res.body.items[0].name).toBe('Alpha Realty')
  })

  it('?limit=1.5 → 200 with a valid page (non-integer limit floored), not 500', async () => {
    await seedThreeTenants()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?limit=1.5')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    // floor(1.5) === 1 → exactly one item on the first page
    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0].name).toBe('Alpha Realty')
  })

  it('?limit=abc → 200 with a valid page (limit defaults to 50), not 500', async () => {
    await seedThreeTenants()
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?limit=abc')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.items).toHaveLength(3)
  })

  // A11: the 200 cap still holds even when the requested limit is malformed-but-large.
  it('?limit=1000 → capped at 200 items (cap still holds after sanitization)', async () => {
    await prisma.platformTenant.createMany({
      data: Array.from({ length: 202 }, (_, i) => ({
        id: `cap2-tenant-${String(i).padStart(3, '0')}`,
        name: `Cap2 Tenant ${String(i).padStart(3, '0')}`,
        slug: `cap2-tenant-${i}`,
        latestStatus: 'ACTIVE',
      })),
    })
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants?limit=1000')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(202)
    expect(res.body.items).toHaveLength(200)
  })

  // Scenario: Unauthenticated request is rejected
  it('GET /api/operators/tenants without token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/operators/tenants')

    expect(res.status).toBe(401)
  })

  // Scenario: Empty registry returns well-formed zero result
  it('GET /api/operators/tenants with empty platform_tenants → 200 + total 0, items []', async () => {
    const cookie = await getSessionCookie()

    const res = await request(app.getHttpServer())
      .get('/api/operators/tenants')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
    expect(res.body.items).toEqual([])
  })

  // Isolation invariant (structural): TenantRegistryService imports no @prisma/client
  // (InmoView's client) — only its own generated client (src/generated/prisma).
  it('TenantRegistryService imports no @prisma/client — only the viewpro-api generated client', () => {
    const serviceSourcePath = join(__dirname, '..', 'tenant-registry.service.ts')
    const source = readFileSync(serviceSourcePath, 'utf8')

    expect(source).not.toContain("from '@prisma/client'")
  })

  // Isolation invariant (DI/structural): ChangeFeedClient (InmoView HTTP touchpoint) is
  // absent from the operator tenant-list module wiring.
  it('ChangeFeedClient is not resolvable in the tenant-registry module wiring', async () => {
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
