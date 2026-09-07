import { TenantMembershipStatus, TenantRole, UserStatus, type Prisma } from '@prisma/client'

type EligibleSellerLockBarrier = (context: { operation: 'create' | 'update'; backendPid: number }) => Promise<void>

let eligibleSellerLockBarrier: EligibleSellerLockBarrier | null = null

export function setEligibleSellerLockBarrierForTest(barrier: EligibleSellerLockBarrier | null) {
  eligibleSellerLockBarrier = barrier
}

export async function lockEligibleSeller(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; proposedByUserId: string; operation: 'create' | 'update' },
): Promise<boolean> {
  const users = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM users
    WHERE id = ${input.proposedByUserId} AND status = ${UserStatus.ACTIVE}::"UserStatus"
    FOR NO KEY UPDATE
  `
  if (users.length === 0) return false

  const memberships = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM tenant_memberships
    WHERE "userId" = ${input.proposedByUserId} AND "tenantId" = ${input.tenantId}
      AND status = ${TenantMembershipStatus.ACTIVE}::"TenantMembershipStatus"
      AND role = ${TenantRole.AGENT}::"TenantRole"
    FOR NO KEY UPDATE
  `
  if (memberships.length === 0) return false

  if (eligibleSellerLockBarrier) {
    const [backend] = await tx.$queryRaw<{ backendPid: number }[]>`SELECT pg_backend_pid() AS "backendPid"`
    await eligibleSellerLockBarrier({ operation: input.operation, backendPid: backend!.backendPid })
  }
  return true
}
