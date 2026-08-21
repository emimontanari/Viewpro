import type { INestApplicationContext } from '@nestjs/common'
import { AuthModule } from '../../auth/auth.module'
import { PASSWORD_HASHER, type IPasswordHasher } from '../../auth/security/password-hasher'
import { PrismaService } from '../../database/prisma.service'
import { assertSafeTestDatabaseUrl, isTestRuntime } from '../../database/test-database-url.guard'

export async function seedPlatformSyncOperatorFixture(
  app: INestApplicationContext,
  { email, password }: { email: string; password: string },
) {
  if (!isTestRuntime()) {
    throw new Error('Platform sync fixture requires test runtime')
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error('Platform sync fixture email is required')
  }
  if (!password.trim()) {
    throw new Error('Platform sync fixture password is required')
  }
  assertSafeTestDatabaseUrl(process.env.DATABASE_URL)
  const prisma = app.get(PrismaService)
  const passwordHasher = app.select(AuthModule).get<IPasswordHasher>(PASSWORD_HASHER, { strict: true })
  const passwordHash = await passwordHasher.hash(password)

  return prisma.operator.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, passwordHash, role: 'OWNER', status: 'ACTIVE' },
    update: { passwordHash, role: 'OWNER', status: 'ACTIVE' },
  })
}
