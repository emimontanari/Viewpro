import { UnprocessableEntityException } from '@nestjs/common'
import type { Prisma } from '@prisma-platform/client'
import type { PrismaService } from '../../database/prisma.service'

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
 *
 * NOTE: this check is direction-AGNOSTIC and deliberately CONSERVATIVE. It
 * looks only at whether `targetId` is the sole remaining ACTIVE OWNER — not at
 * whether the pending mutation actually reduces the ACTIVE-OWNER count. So it
 * conservatively blocks ANY role/status mutation targeting the sole ACTIVE
 * OWNER, INCLUDING no-ops (e.g. reactivating/re-promoting an already ACTIVE
 * sole OWNER). This over-rejection is intentional fail-closed behavior (never
 * risk leaving the platform with zero active OWNERs), NOT false-positive-free.
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

/**
 * withLastOwnerGuard — composes `assertNotLastActiveOwner` with a caller-
 * supplied mutation inside a SINGLE `prisma.$transaction`, so the `FOR
 * UPDATE` lock and the mutation are atomic (T1.2.6 — wires the tx-threaded
 * guardrail into the operator role/status change path). Used by
 * change-role-operator.use-case.ts and change-status-operator.use-case.ts
 * (T1.3.6/T1.3.8) so every mutating call is guard-checked and applied within
 * the same transaction, never as two separate round trips.
 */
export async function withLastOwnerGuard<T>(
  prisma: PrismaService,
  targetId: string,
  mutate: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await assertNotLastActiveOwner(tx, targetId)
    return mutate(tx)
  })
}
