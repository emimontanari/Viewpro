import type { INestApplicationContext } from '@nestjs/common'
import type { OperatorStatus, PlatformOperatorRole } from '@prisma-platform/client'
import { AuthModule } from '../auth/auth.module'
import { PASSWORD_HASHER, type IPasswordHasher } from '../auth/security/password-hasher'
import { PrismaService } from '../database/prisma.service'
import { assertSafeTestDatabaseUrl, isTestRuntime } from '../database/test-database-url.guard'

export type OperatorFixtureInput = {
  email: string
  password: string
  role?: PlatformOperatorRole
  status?: OperatorStatus
}

export type OperatorFixture = {
  id: string
  email: string
  role: PlatformOperatorRole
  status: OperatorStatus
}

/** Test-only Nest fixture; defaults to OWNER/ACTIVE and owns no Prisma lifecycle. */
export async function seedOperatorFixture(
  app: INestApplicationContext,
  input: OperatorFixtureInput,
): Promise<OperatorFixture> {
  if (!isTestRuntime()) {
    throw new Error('Operator fixture requires test runtime')
  }
  assertSafeTestDatabaseUrl(process.env.DATABASE_URL)

  const email = input.email.trim().toLowerCase()
  if (!email) {
    throw new Error('Operator fixture email is required')
  }
  if (!input.password.trim()) {
    throw new Error('Operator fixture password is required')
  }

  const prisma = app.get(PrismaService)
  const passwordHasher = app.select(AuthModule).get<IPasswordHasher>(PASSWORD_HASHER, { strict: true })
  const passwordHash = await passwordHasher.hash(input.password)
  const role = input.role ?? 'OWNER'
  const status = input.status ?? 'ACTIVE'

  return prisma.operator.upsert({
    where: { email },
    create: { email, passwordHash, role, status },
    update: { email, passwordHash, role, status },
    select: { id: true, email: true, role: true, status: true },
  })
}
