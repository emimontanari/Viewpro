import { describe, expect, it } from "vitest";
import type { MembershipActivityRecord } from "../../memberships/membership-activity.repository";
import { mapActivityFeedMembership } from "./activity-feed.response";

/**
 * platform-user-activity-capture — RED: mapActivityFeedMembership
 *
 * Spec: platform-user-activity-capture — Domain 2 "Three-source merged
 *   activity feed" (globally-unique prefixed id per item, e.g.
 *   `membership-invited:<id>`).
 * Design D1 "Item shape": one `kind: 'membership'` sub-discriminated by
 *   `membershipEvent`. `subject` = who the event is about, `actor` = who
 *   performed it (`null` when there is none — JOINED has no actor, per D1c).
 */

const inviter = { id: "inviter-1", email: "inviter@example.com", firstName: "Inviter" };
const member = { id: "member-1", email: "member@example.com", firstName: "Member" };
const deactivator = { id: "actor-1", email: "actor@example.com", firstName: "Actor" };

describe("mapActivityFeedMembership()", () => {
	it("maps an INVITED record with the invitee as subject and the inviter as actor", () => {
		const record: MembershipActivityRecord = {
			event: "INVITED",
			id: "invitation-1",
			tenantId: "tenant-1",
			createdAt: new Date("2026-06-01T10:00:00.000Z"),
			email: "invitee@example.com",
			invitedByUser: inviter,
		};

		const result = mapActivityFeedMembership(record);

		expect(result).toMatchObject({
			kind: "membership",
			id: "membership-invited:invitation-1",
			tenantId: "tenant-1",
			createdAt: "2026-06-01T10:00:00.000Z",
			membershipEvent: "INVITED",
			subject: { email: "invitee@example.com", firstName: null },
			actor: { id: inviter.id, email: inviter.email, firstName: inviter.firstName },
		});
	});

	it("maps a JOINED record with the member as subject and NO actor (no invited-by heuristic)", () => {
		const record: MembershipActivityRecord = {
			event: "JOINED",
			id: "membership-1",
			tenantId: "tenant-1",
			createdAt: new Date("2026-06-02T10:00:00.000Z"),
			user: member,
		};

		const result = mapActivityFeedMembership(record);

		expect(result).toMatchObject({
			kind: "membership",
			id: "membership-joined:membership-1",
			tenantId: "tenant-1",
			createdAt: "2026-06-02T10:00:00.000Z",
			membershipEvent: "JOINED",
			subject: { id: member.id, email: member.email, firstName: member.firstName },
			actor: null,
		});
	});

	it("maps a DEACTIVATED record with the member as subject and the deactivator as actor", () => {
		const record: MembershipActivityRecord = {
			event: "DEACTIVATED",
			id: "membership-2",
			tenantId: "tenant-1",
			createdAt: new Date("2026-06-03T09:00:00.000Z"),
			user: member,
			deactivatedByUser: deactivator,
		};

		const result = mapActivityFeedMembership(record);

		expect(result).toMatchObject({
			kind: "membership",
			id: "membership-deactivated:membership-2",
			tenantId: "tenant-1",
			createdAt: "2026-06-03T09:00:00.000Z",
			membershipEvent: "DEACTIVATED",
			subject: { id: member.id, email: member.email, firstName: member.firstName },
			actor: { id: deactivator.id, email: deactivator.email, firstName: deactivator.firstName },
		});
	});

	it("maps a DEACTIVATED record with a null actor when the deactivating actor could not be resolved", () => {
		const record: MembershipActivityRecord = {
			event: "DEACTIVATED",
			id: "membership-3",
			tenantId: "tenant-1",
			createdAt: new Date("2026-06-04T09:00:00.000Z"),
			user: member,
			deactivatedByUser: null,
		};

		const result = mapActivityFeedMembership(record);

		expect(result.actor).toBeNull();
	});
});
