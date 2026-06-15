import { Prisma } from '@prisma/client'

/**
 * Returns true when `error` is a Prisma P2002 unique constraint violation
 * whose `meta.constraint` or `meta.target` array identifies the given
 * constraint name.
 *
 * Both meta shapes are checked because Prisma's P2002 metadata is not
 * stable across versions — partial unique indexes may surface the
 * constraint name under `meta.constraint` (string) or `meta.target`
 * (string array). Checking both ensures the guard works regardless of
 * minor Prisma version differences.
 */
export function isPartialUniqueViolation(error: unknown, constraintName: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false
  }

  if (error.code !== 'P2002') {
    return false
  }

  const meta = error.meta as Record<string, unknown> | undefined

  if (!meta) {
    return false
  }

  // Shape 1: meta.constraint is a string matching the constraint name
  if (typeof meta.constraint === 'string' && meta.constraint === constraintName) {
    return true
  }

  // Shape 2: meta.target is an array that includes the constraint name
  if (Array.isArray(meta.target) && meta.target.includes(constraintName)) {
    return true
  }

  return false
}
