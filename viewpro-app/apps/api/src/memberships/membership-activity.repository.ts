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

/**
 * MembershipActivityRecord — derived, read-only membership lifecycle events
 * (INVITED/JOINED/DEACTIVATED), sourced from existing `TeamInvitation` and
 * `TenantMembership` rows. `id` is the RAW underlying row id (invitationId
 * for INVITED, membershipId for JOINED/DEACTIVATED) — the globally-unique
 * `membership-{invited,joined,deactivated}:` prefix required by
 * `compareActivityItems`' tie-break is applied later by
 * `mapActivityFeedMembership` (apps/api/src/analytics/responses/activity-feed.response.ts),
 * not here.
 */
export type MembershipActivityRecord =
	| MembershipActivityInvitedRecord
	| MembershipActivityJoinedRecord
	| MembershipActivityDeactivatedRecord;

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
