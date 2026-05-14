import type { Prisma, TenantMembership } from '@prisma/client'

export const MEMBERSHIPS_REPOSITORY = Symbol('MEMBERSHIPS_REPOSITORY')

export type MembershipWithTenant = Prisma.TenantMembershipGetPayload<{ include: { tenant: true } }>

export type MembershipWithUserAndTenant = Prisma.TenantMembershipGetPayload<{
  include: { user: true; tenant: true }
}>

export type MembershipsRepository = {
  create(data: Prisma.TenantMembershipCreateInput): Promise<TenantMembership>
  findManyByUserId(userId: string): Promise<MembershipWithTenant[]>
  findByUserIdAndTenantId(userId: string, tenantId: string): Promise<MembershipWithUserAndTenant | null>
}
