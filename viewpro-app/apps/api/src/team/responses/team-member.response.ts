import type { TenantRole, UserStatus } from "@prisma/client";
import type { MembershipWithUserAndTenant } from "../../memberships/memberships.repository";

export type TeamMemberStatus = "ACTIVE" | "DEACTIVATED";

export type TeamMemberResponse = {
	membershipId: string;
	userId: string;
	email: string;
	firstName: string;
	lastName: string | null;
	userStatus: UserStatus;
	role: TenantRole;
	membershipStatus: TeamMemberStatus;
	deactivatedAt: string | null;
	deactivatedByUserId: string | null;
	createdAt: string;
	updatedAt: string;
};

export type TeamMembersResponse = {
	items: TeamMemberResponse[];
};

type MembershipWithAccessMetadata = MembershipWithUserAndTenant & {
	status: TeamMemberStatus;
	deactivatedAt: Date | null;
	deactivatedByUserId: string | null;
};

export function toTeamMemberResponse(
	membership: MembershipWithAccessMetadata,
): TeamMemberResponse {
	return {
		membershipId: membership.id,
		userId: membership.userId,
		email: membership.user.email,
		firstName: membership.user.firstName,
		lastName: membership.user.lastName,
		userStatus: membership.user.status,
		role: membership.role,
		membershipStatus: membership.status,
		deactivatedAt: membership.deactivatedAt?.toISOString() ?? null,
		deactivatedByUserId: membership.deactivatedByUserId,
		createdAt: membership.createdAt.toISOString(),
		updatedAt: membership.updatedAt.toISOString(),
	};
}
