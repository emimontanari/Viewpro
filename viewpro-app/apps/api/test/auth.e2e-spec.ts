import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/database/prisma.service'
import { createApiApp } from '../src/bootstrap/create-app'

describe('AuthController (e2e)', () => {
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

  it('registers a tenant, persists safe auth records, and sets httpOnly cookies', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send({
        whatsappPhone: '3510000000',
        email: 'Owner@Example.com',
        password: 'password123',
        firstName: 'Owner',
        tenantName: 'Acme Homes',
      })
      .expect(201)

    expect(response.body).toMatchObject({
      user: {
        email: 'owner@example.com',
        firstName: 'Owner',
        globalRole: 'USER',
        status: 'ACTIVE',
        emailVerifiedAt: null,
      },
      memberships: [
        {
          role: 'PRINCIPAL_MANAGER',
          tenant: { name: 'Acme Homes', slug: 'acme-homes', status: 'TRIAL' },
        },
      ],
    })
    expect(response.body.user.passwordHash).toBeUndefined()
    expect(response.body.accessToken).toBeUndefined()
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('viewpro_access_token='),
        expect.stringContaining('viewpro_refresh_token='),
      ]),
    )
    expect(response.headers['set-cookie'].join(';')).toContain('HttpOnly')
    const refreshCookie = response.headers['set-cookie'].find((cookie: string) =>
      cookie.startsWith('viewpro_refresh_token='),
    )
    expect(refreshCookie).toContain('Path=/')

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@example.com' } })
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: 'acme-homes' } })
    const membership = await prisma.tenantMembership.findUniqueOrThrow({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    })
    const refreshToken = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id } })

    expect(user.passwordHash).not.toBe('password123')
    expect(user.passwordHash).toContain('argon2id')
    expect(user.globalRole).toBe('USER')
    expect(membership.role).toBe('PRINCIPAL_MANAGER')
    expect(refreshToken.tokenHash).toHaveLength(64)
  })

  it('rejects duplicate registration email without leaking secrets', async () => {
    await registerTenant('duplicate@example.com')

    const response = await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send({
        whatsappPhone: '3510000000',
        email: 'DUPLICATE@example.com',
        password: 'password123',
        firstName: 'Other',
        tenantName: 'Other Homes',
      })
      .expect(409)

    expect(response.body.message).toBe('Email is already registered')
    await expect(prisma.user.count()).resolves.toBe(1)
  })

  it('logs in, reads /me from DB, refreshes by rotation, and logs out', async () => {
    await registerTenant('login@example.com')
    const agent = request.agent(app.getHttpServer())

    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ email: 'LOGIN@example.com', password: 'password123' })
      .expect(201)

    expect(loginResponse.body.user.email).toBe('login@example.com')
    expect(loginResponse.body.accessToken).toBeUndefined()

    const meResponse = await agent.get('/api/auth/me').expect(200)
    expect(meResponse.body).toMatchObject({
      user: { email: 'login@example.com', globalRole: 'USER' },
      memberships: [{ role: 'PRINCIPAL_MANAGER', tenant: { slug: 'login-homes' } }],
    })
    expect(meResponse.body.user.globalRole).not.toBe(meResponse.body.memberships[0].role)

    const refreshTokensBefore = await prisma.refreshToken.findMany({
      where: { user: { email: 'login@example.com' } },
      orderBy: { createdAt: 'asc' },
    })

    const refreshResponse = await agent.post('/api/auth/refresh').expect(201)
    expect(refreshResponse.body.user.email).toBe('login@example.com')

    const refreshTokensAfter = await prisma.refreshToken.findMany({
      where: { user: { email: 'login@example.com' } },
      orderBy: { createdAt: 'asc' },
    })
    expect(refreshTokensAfter).toHaveLength(refreshTokensBefore.length + 1)
    expect(refreshTokensAfter[refreshTokensBefore.length - 1]?.revokedAt).not.toBeNull()
    expect(refreshTokensAfter[refreshTokensBefore.length - 1]?.replacedByTokenId).toBe(
      refreshTokensAfter[refreshTokensAfter.length - 1]?.id,
    )

    await agent.get('/api/auth/me').expect(200)

    const logoutResponse = await agent.post('/api/auth/logout').expect(201)
    expect(logoutResponse.body).toEqual({ ok: true })
    expect(logoutResponse.headers['set-cookie'].join(';')).toContain('viewpro_access_token=;')

    await agent.get('/api/auth/me').expect(401)
  })

  it('returns VIEWPRO_ADMIN as an independent global role on /me', async () => {
    await registerTenant('admin@example.com')
    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { globalRole: 'VIEWPRO_ADMIN' },
    })

    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').send({ email: 'admin@example.com', password: 'password123' }).expect(201)

    const meResponse = await agent.get('/api/auth/me').expect(200)
    expect(meResponse.body).toMatchObject({
      user: { email: 'admin@example.com', globalRole: 'VIEWPRO_ADMIN' },
      memberships: [{ role: 'PRINCIPAL_MANAGER', tenant: { slug: 'duplicate-homes' } }],
    })
    expect(meResponse.body.user.globalRole).not.toBe(meResponse.body.memberships[0].role)
  })

  it('rejects wrong login password and unauthenticated session access', async () => {
    await registerTenant('wrong-password@example.com')

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'wrong-password@example.com', password: 'bad-password' })
      .expect(401)

    expect(response.body.message).toBe('Invalid email or password')
    await request(app.getHttpServer()).get('/api/auth/me').expect(401)
    await request(app.getHttpServer()).post('/api/auth/refresh').expect(401)
  })

  async function registerTenant(email: string) {
    return request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send({
        whatsappPhone: '3510000000',
        email,
        password: 'password123',
        firstName: 'Owner',
        tenantName: email.startsWith('login') ? 'Login Homes' : 'Duplicate Homes',
      })
      .expect(201)
  }
})

describe('AuthController throttling (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('rate-limits repeated login attempts without throttling guarded reads', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'rate-limit-login@example.com', password: 'wrong-password' })
        .expect(401)
    }

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'rate-limit-login@example.com', password: 'wrong-password' })
      .expect(429)

    await request(app.getHttpServer()).get('/api/auth/me').expect(401)
  })

  it('keeps login throttling scoped to the route path instead of query strings', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post(`/api/auth/login?cacheBust=${attempt}`)
        .send({ email: 'query-bucket-login@example.com', password: 'wrong-password' })
        .expect(401)
    }

    await request(app.getHttpServer())
      .post('/api/auth/login?cacheBust=final')
      .send({ email: 'query-bucket-login@example.com', password: 'wrong-password' })
      .expect(429)
  })

  it('rate-limits repeated tenant registration attempts on the register route only', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/register-tenant')
        .send({
          whatsappPhone: '3510000000',
          email: 'rate-limit-register@example.com',
          password: 'short',
          firstName: 'Owner',
          tenantName: 'Rate Limited Homes',
        })
        .expect(400)
    }

    await request(app.getHttpServer())
      .post('/api/auth/register-tenant')
      .send({
        whatsappPhone: '3510000000',
        email: 'rate-limit-register@example.com',
        password: 'short',
        firstName: 'Owner',
        tenantName: 'Rate Limited Homes',
      })
      .expect(429)

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'register-route-scope@example.com', password: 'wrong-password' })
      .expect(401)
  })

  it('rate-limits repeated refresh attempts on the refresh route only', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', [`viewpro_refresh_token=invalid-refresh-${attempt}`])
        .expect(401)
    }

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', ['viewpro_refresh_token=invalid-refresh-final'])
      .expect(429)

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'refresh-route-scope@example.com', password: 'wrong-password' })
      .expect(401)
  })
})
