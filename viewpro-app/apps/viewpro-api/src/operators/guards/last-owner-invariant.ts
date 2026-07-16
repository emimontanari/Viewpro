import { UnprocessableEntityException } from '@nestjs/common'
import type { Prisma } from '@prisma-platform/client'

const LAST_OWNER_RESPONSE = {
  statusCode: 422,
  code: 'LAST_OWNER_PROTECTED',
  message: 'This action would leave the platform with zero active OWNER operators',
}

/**
 * assertNotLastActiveOwner — race-safe last-OWNER invariant (Decision 2,
 * platform-operator-management). MUST be called inside a `prisma.$transaction`
 * so the `FOR UPDATE` row lock actually serializes concurrent callers.
 *
 * `SELECT ... FOR UPDATE` locks the entire ACTIVE-OWNER row set. Two
 * concurrent transactions each targeting a DIFFERENT owner from that same set
 * physically serialize on the shared lock: the second transaction blocks
 * until the first commits, then re-reads the post-commit state and correctly
 * observes zero remaining ACTIVE OWNERs (excluding its own target) if the
 * first transaction already demoted/suspended the last other OWNER.
 *
 * Rejects with a 422 UnprocessableEntityException (code LAST_OWNER_PROTECTED)
 * if excluding `targetId` from the locked ACTIVE-OWNER set would leave zero
 * remaining ACTIVE OWNERs. Resolves (void) otherwise.
 */
export async function assertNotLastActiveOwner(tx: Prisma.TransactionClient, targetId: string): Promise<void> {
  const lockedOwners = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Operator" WHERE role = 'OWNER' AND status = 'ACTIVE' FOR UPDATE
  `

  const remainingOwnerCount = lockedOwners.filter((owner) => owner.id !== targetId).length

  if (remainingOwnerCount === 0) {
    throw new UnprocessableEntityException(LAST_OWNER_RESPONSE)
  }
}
