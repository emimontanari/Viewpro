import { describe, expect, it, beforeAll } from 'vitest'
import { PrismaClient } from '@prisma-platform/client'
import { execSync } from 'node:child_process'

const prisma = new PrismaClient()

describe('Prisma seed', () => {
  beforeAll(async () => {
    // Clean operator table before seeding
    await prisma.operator.deleteMany()

    // Run seed with test env vars
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: 'seed-test@viewpro.app',
        SEED_OPERATOR_PASSWORD: 'seed-test-password',
      },
    })
  })

  it('creates an operator with non-empty email and passwordHash', async () => {
    const operator = await prisma.operator.findFirst()

    expect(operator).not.toBeNull()
    expect(operator?.email).toBeTruthy()
    expect(operator?.passwordHash).toBeTruthy()
    expect(operator?.passwordHash.length).toBeGreaterThan(0)
  })

  it('seeds the operator with an explicit OWNER role (D9 — post-migration backfill proxy)', async () => {
    const operator = await prisma.operator.findFirst()

    expect(operator?.role).toBe('OWNER')
  })

  it('seed is idempotent — re-running does not create a duplicate', async () => {
    execSync('pnpm db:seed', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SEED_OPERATOR_EMAIL: 'seed-test@viewpro.app',
        SEED_OPERATOR_PASSWORD: 'seed-test-password',
      },
    })

    const count = await prisma.operator.count({
      where: { email: 'seed-test@viewpro.app' },
    })

    expect(count).toBe(1)
  })

  it('InmoView DATABASE_URL env var is not set during this test (isolation check)', () => {
    expect(process.env.INMV_DATABASE_URL).toBeUndefined()
  })
})
