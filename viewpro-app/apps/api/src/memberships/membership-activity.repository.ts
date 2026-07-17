import type { TenantRole } from "@prisma/client";

export const MEMBERSHIP_ACTIVITY_REPOSITORY = Symbol(
	"MEMBERSHIP_ACTIVITY_REPOSITORY",
);

export type MembershipActivityActor = {
	id: string;
	email: string;
	firstName: string;
};

export type MembershipActivityInvitedRecord = {
	event: "INVITED";
	id: string;
	tenantId: string;
	createdAt: Date;
	email: string;
	invitedByUser: MembershipActivityActor;
};

export type MembershipActivityJoinedRecord = {
	event: "JOINED";
	id: string;
	tenantId: string;
	createdAt: Date;
	user: MembershipActivityActor;
};

export type MembershipActivityDeactivatedRecord = {
	event: "DEACTIVATED";
	id: string;
	tenantId: string;
	createdAt: Date;
	user: MembershipActivityActor;
	deactivatedByUser: MembershipActivityActor | null;
};

export type MembershipActivityRoleChangedRecord = {
	event: "ROLE_CHANGED";
	id: string; // AnalyticsEvent.id
	tenantId: string;
	createdAt: Date; // = AnalyticsEvent.occurredAt
	subject: MembershipActivityActor; // the member whose role changed
	actor: MembershipActivityActor | null; // who changed it
	previousRole: TenantRole;
	newRole: TenantRole;
};

/**
 * MembershipActivityRecord — derived, read-only membership lifecycle events
 * (INVITED/JOINED/DEACTIVATED/ROLE_CHANGED), sourced from existing
 * `TeamInvitation`/`TenantMembership` rows (first 3) and `AnalyticsEvent`
 * rows written by the atomic role-change write path (ROLE_CHANGED, the sole
 * exception per spec's "No new writes or migrations" requirement). `id` is
 * the RAW underlying row id (invitationId for INVITED, membershipId for
 * JOINED/DEACTIVATED, AnalyticsEvent.id for ROLE_CHANGED) — the
 * globally-unique `member{,ship}-{invited,joined,deactivated,role-changed}:`
 * prefix required by `compareActivityItems`' tie-break is applied later by
 * `mapActivityFeedMembership` (apps/api/src/analytics/responses/activity-feed.response.ts),
 * not here.
 */
export type MembershipActivityRecord =
	| MembershipActivityInvitedRecord
	| MembershipActivityJoinedRecord
	| MembershipActivityDeactivatedRecord
	| MembershipActivityRoleChangedRecord;

export type FindManyMembershipActivityInput = {
	tenantId: string;
	page: number;
	pageSize: number;
};

export type MembershipActivityRepository = {
	findManyByTenant(
		input: FindManyMembershipActivityInput,
	): Promise<{ items: MembershipActivityRecord[]; total: number }>;
};
