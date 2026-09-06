import { TenantMembershipStatus, TenantRole, UserStatus, type Prisma } from '@prisma/client'

export async function lockEligibleSeller(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; proposedByUserId: string },
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
  return memberships.length > 0
}
