/**
 * Idempotent seed for the first ViewPro platform operator.
 *
 * NOTE (deferred follow-up): VIEWPRO_ADMIN → Operator migration is a separate follow-up task;
 * existing records in InmoView's `viewpro` DB are untouched.
 */
import { PrismaClient } from '../src/generated/prisma'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SEED_OPERATOR_EMAIL
  const password = process.env.SEED_OPERATOR_PASSWORD

  if (!email) {
    throw new Error('SEED_OPERATOR_EMAIL env var is required')
  }

  if (!password) {
    throw new Error('SEED_OPERATOR_PASSWORD env var is required')
  }

  const passwordHash = await argon2.hash(password)

  const operator = await prisma.operator.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      status: 'ACTIVE',
      role: 'OWNER',
    },
  })

  console.log(`Seeded operator: ${operator.email} (id=${operator.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })
