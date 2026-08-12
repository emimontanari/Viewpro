import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { Test, type TestingModule } from '@nestjs/testing'
import type { INestApplication } from '@nestjs/common'
import { ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from '../../auth/auth.module'
import { PASSWORD_HASHER, type IPasswordHasher } from '../../auth/security/password-hasher'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { PrismaService } from '../../database/prisma.service'
import { seedOperatorFixture } from '../operator.fixture'

const EMAIL_PREFIX = 'operator-fixture-pr1-'

describe('seedOperatorFixture', () => {
  let app: INestApplication
  let prisma: PrismaService
  let passwordHasher: IPasswordHasher

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
        DatabaseModule,
        AuthModule,
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
    passwordHasher = app.select(AuthModule).get(PASSWORD_HASHER, { strict: true })
  })

  afterEach(async () => {
    await prisma.operator.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } })
  })

  afterAll(async () => {
    await expect(app.close()).resolves.toBeUndefined()
  })

  it('fails closed before dependency resolution outside test runtime or against an unsafe URL', async () => {
    const environment = process.env
    const unavailableApp = {
      get: () => { throw new Error('dependency resolution must not run') },
      select: () => { throw new Error('dependency resolution must not run') },
    }

    try {
      process.env = { ...environment, NODE_ENV: 'development', VIEWPRO_TEST_RUN: undefined, VITEST: undefined }
      await expect(seedOperatorFixture(unavailableApp as never, { email: 'operator-fixture-pr1-guard@fixture.test', password: 'password' }))
        .rejects.toThrow('Operator fixture requires test runtime')

      process.env = { ...environment, DATABASE_URL: 'postgresql://user:password@localhost/viewpro_platform' }
      await expect(seedOperatorFixture(unavailableApp as never, { email: 'operator-fixture-pr1-guard@fixture.test', password: 'password' }))
        .rejects.toThrow('non-test database')
    } finally {
      process.env = environment
    }
  })

  it('rejects a blank password without persisting fixture-owned state', async () => {
    const email = `${EMAIL_PREFIX}blank-password@fixture.test`

    await expect(seedOperatorFixture(app, { email, password: '   ' }))
      .rejects.toThrow('Operator fixture password is required')
    expect(await prisma.operator.count({ where: { email } })).toBe(0)
  })

  it('persists canonical default operator state through the initialized Nest context', async () => {
    const password = 'fixture-default-password'
    const seeded = await seedOperatorFixture(app, {
      email: ` ${EMAIL_PREFIX}DEFAULT@fixture.test `,
      password,
    })
    const persisted = await prisma.operator.findUniqueOrThrow({ where: { email: `${EMAIL_PREFIX}default@fixture.test` } })

    expect(seeded).toEqual({ id: persisted.id, email: persisted.email, role: 'OWNER', status: 'ACTIVE' })
    expect(await passwordHasher.verify(persisted.passwordHash, password)).toBe(true)
  })

  it('upserts one canonical row, preserving its id while resetting overrides and password', async () => {
    const email = `${EMAIL_PREFIX}reset@fixture.test`
    const initial = await seedOperatorFixture(app, {
      email,
      password: 'fixture-old-password',
      role: 'ANALYST',
      status: 'SUSPENDED',
    })
    const reset = await seedOperatorFixture(app, {
      email: ` ${email.toUpperCase()} `,
      password: 'fixture-new-password',
      role: 'OPERATIONS',
      status: 'ACTIVE',
    })
    const persisted = await prisma.operator.findUniqueOrThrow({ where: { email } })

    expect(reset).toEqual({ id: initial.id, email, role: 'OPERATIONS', status: 'ACTIVE' })
    expect(await prisma.operator.count({ where: { email } })).toBe(1)
    expect(persisted).toMatchObject({ id: initial.id, role: 'OPERATIONS', status: 'ACTIVE' })
    expect(await passwordHasher.verify(persisted.passwordHash, 'fixture-new-password')).toBe(true)
    expect(await passwordHasher.verify(persisted.passwordHash, 'fixture-old-password')).toBe(false)
  })

  it('propagates a hasher failure without retrying or mutating the existing row', async () => {
    const email = `${EMAIL_PREFIX}hash-failure@fixture.test`
    await seedOperatorFixture(app, { email, password: 'fixture-original-password', role: 'ANALYST', status: 'SUSPENDED' })
    const before = await prisma.operator.findUniqueOrThrow({ where: { email } })
    const failure = new Error('fixture hash failure')
    const hash = vi.spyOn(passwordHasher, 'hash').mockRejectedValue(failure)
    const upsert = vi.spyOn(prisma.operator, 'upsert')

    try {
      await expect(seedOperatorFixture(app, { email, password: 'fixture-replacement-password' })).rejects.toBe(failure)
      expect(hash).toHaveBeenCalledTimes(1)
      expect(upsert).not.toHaveBeenCalled()
      expect(await prisma.operator.findUniqueOrThrow({ where: { email } })).toMatchObject(before)
    } finally {
      hash.mockRestore()
      upsert.mockRestore()
    }
  })

  it('propagates a Prisma failure once without partially mutating the existing row', async () => {
    const email = `${EMAIL_PREFIX}prisma-failure@fixture.test`
    await seedOperatorFixture(app, { email, password: 'fixture-original-password', role: 'ANALYST', status: 'SUSPENDED' })
    const before = await prisma.operator.findUniqueOrThrow({ where: { email } })
    const failure = new Error('fixture Prisma failure')
    const upsert = vi.spyOn(prisma.operator, 'upsert').mockRejectedValue(failure)

    try {
      await expect(seedOperatorFixture(app, { email, password: 'fixture-replacement-password', role: 'OWNER', status: 'ACTIVE' })).rejects.toBe(failure)
      expect(upsert).toHaveBeenCalledTimes(1)
      expect(await prisma.operator.findUniqueOrThrow({ where: { email } })).toMatchObject(before)
    } finally {
      upsert.mockRestore()
    }
  })
})
