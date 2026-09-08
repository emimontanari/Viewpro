import { Prisma, TenantMembershipStatus, TenantRole, UserStatus, type Prisma as PrismaTypes } from '@prisma/client'

export type ApprovalIdentityLocks = {
  reviewer: { id: string; status: UserStatus } | undefined
  reviewerMembership: { id: string; userId: string; role: TenantRole; status: TenantMembershipStatus } | undefined
  proposer: { id: string; status: UserStatus } | undefined
  proposerMembership: { id: string; userId: string; role: TenantRole; status: TenantMembershipStatus } | undefined
}

export async function lockApprovalIdentities(
  tx: PrismaTypes.TransactionClient,
  input: { tenantId: string; reviewerUserId: string; proposerUserId: string },
): Promise<ApprovalIdentityLocks> {
  const userIds = [...new Set([input.reviewerUserId, input.proposerUserId])].sort()
  const users = await tx.$queryRaw<{ id: string; status: UserStatus }[]>`
    SELECT id, status FROM users WHERE id IN (${Prisma.join(userIds)}) ORDER BY id ASC FOR NO KEY UPDATE
  `
  const memberships = await tx.$queryRaw<{ id: string; userId: string; role: TenantRole; status: TenantMembershipStatus }[]>`
    SELECT id, "userId", role, status FROM tenant_memberships
    WHERE "tenantId" = ${input.tenantId} AND "userId" IN (${Prisma.join(userIds)}) ORDER BY id ASC FOR NO KEY UPDATE
  `
  return {
    reviewer: users.find(({ id }) => id === input.reviewerUserId),
    reviewerMembership: memberships.find(({ userId }) => userId === input.reviewerUserId),
    proposer: users.find(({ id }) => id === input.proposerUserId),
    proposerMembership: memberships.find(({ userId }) => userId === input.proposerUserId),
  }
}
