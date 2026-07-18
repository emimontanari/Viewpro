import type { Prisma, TenantMembership, TenantRole } from "@prisma/client";

export const MEMBERSHIPS_REPOSITORY = Symbol("MEMBERSHIPS_REPOSITORY");

export type TenantMembershipAccessStatus = "ACTIVE" | "DEACTIVATED";

export type MembershipAccessMetadata = {
	status: TenantMembershipAccessStatus;
	deactivatedAt: Date | null;
	deactivatedByUserId: string | null;
};

export type MembershipWithTenant = Prisma.TenantMembershipGetPayload<{
	include: { tenant: true };
}> &
	MembershipAccessMetadata;

export type MembershipWithUserAndTenant = Prisma.TenantMembershipGetPayload<{
	include: { user: true; tenant: true };
}> &
	MembershipAccessMetadata;

export type MembershipsRepository = {
	create(data: Prisma.TenantMembershipCreateInput): Promise<TenantMembership>;
	findManyByUserId(userId: string): Promise<MembershipWithTenant[]>;
	findActiveManyByUserId(userId: string): Promise<MembershipWithTenant[]>;
	findManyByTenantId(tenantId: string): Promise<MembershipWithUserAndTenant[]>;
	findByIdForTenant(
		membershipId: string,
		tenantId: string,
	): Promise<MembershipWithUserAndTenant | null>;
	findByUserIdAndTenantId(
		userId: string,
		tenantId: string,
	): Promise<MembershipWithUserAndTenant | null>;
	findActiveByUserIdAndTenantId(
		userId: string,
		tenantId: string,
	): Promise<MembershipWithUserAndTenant | null>;
	updateRoleForTenant(input: {
		membershipId: string;
		tenantId: string;
		role: Extract<TenantRole, "MANAGER" | "AGENT">;
		actorUserId: string;
		now?: Date;
	}): Promise<MembershipWithUserAndTenant | null>;
	deactivateForTenant(input: {
		membershipId: string;
		tenantId: string;
		actorUserId: string;
		now?: Date;
	}): Promise<MembershipWithUserAndTenant | null>;
};
