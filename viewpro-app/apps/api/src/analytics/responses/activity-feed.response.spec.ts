import { describe, expect, it } from "vitest";
import type { ActivityDocumentRequestRecord } from "../../documents/documents.repository";
import type { MembershipActivityRecord } from "../../memberships/membership-activity.repository";
import type { ActivityMovementWithRelations } from "../../movements/movements.repository";
import {
	mapActivityFeedDocumentRequest,
	mapActivityFeedMembership,
	mapActivityFeedMovement,
	type PropertyImageDto,
} from "./activity-feed.response";

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

/**
 * operator-activity-media (Slice 1) — RED: mapActivityFeedMovement /
 * mapActivityFeedDocumentRequest gain an optional `imagesByAssetId` 2nd
 * param.
 *
 * Spec: activity-feed-property-images — "Property Images Exposed in Feed
 *   DTO" (present -> populated `property.images`; absent/no-match -> `[]`,
 *   never a throw or an omitted item).
 * Design D1: mappers stay pure — the caller (only
 *   `GetPlatformTenantActivityUseCase`) supplies the pre-built
 *   `ReadonlyMap<string, PropertyImageDto[]>`; env-dependent URL building
 *   happens OUTSIDE the mapper.
 */
const baseEngagement = {
	id: "engagement-1",
	tenantId: "tenant-1",
	propertyAssetId: "asset-1",
	operationType: "SALE",
	status: "INQUIRIES_AND_VISITS",
	propertyAsset: {
		title: "Casa Palermo",
		addressLine: "Uriarte 1234",
		city: "Buenos Aires",
		province: "CABA",
	},
	agents: [],
} as unknown as ActivityMovementWithRelations["propertyEngagement"];

function makeMovementFixture(): ActivityMovementWithRelations {
	return {
		id: "movement-1",
		tenantId: "tenant-1",
		propertyEngagementId: "engagement-1",
		type: "INQUIRY",
		observation: "obs",
		nextStep: null,
		previousStatus: null,
		newStatus: null,
		source: "MANUAL",
		interestCount: null,
		visitCount: null,
		offerAmountCents: null,
		interestLevel: null,
		createdAt: new Date("2026-06-01T10:00:00.000Z"),
		createdBy: { id: "seller-1", email: "seller@example.com", firstName: "Seller" },
		propertyEngagement: baseEngagement,
	} as unknown as ActivityMovementWithRelations;
}

function makeDocumentRequestFixture(): ActivityDocumentRequestRecord {
	return {
		id: "document-request-1",
		tenantId: "tenant-1",
		propertyEngagementId: "engagement-1",
		title: "DNI del propietario",
		description: "Frente y dorso.",
		status: "PENDING",
		createdAt: new Date("2026-06-02T10:00:00.000Z"),
		document: null,
		propertyAssetOwner: null,
		propertyEngagement: baseEngagement,
		requestedByUser: { id: "seller-1", email: "seller@example.com", firstName: "Seller" },
	} as unknown as ActivityDocumentRequestRecord;
}

const asset1Images: PropertyImageDto[] = [
	{ id: "img-1", url: "https://cdn.example.com/img-1.jpg", isPrimary: true, originalFilename: "front.jpg" },
];

describe("mapActivityFeedMovement() — property.images", () => {
	it("populates property.images from the map when the engagement's asset id has an entry", () => {
		const imagesByAssetId = new Map<string, PropertyImageDto[]>([["asset-1", asset1Images]]);

		const result = mapActivityFeedMovement(makeMovementFixture(), imagesByAssetId);

		expect(result.property.images).toEqual(asset1Images);
	});

	it("defaults to an empty array when no imagesByAssetId map is passed at all", () => {
		const result = mapActivityFeedMovement(makeMovementFixture());

		expect(result.property.images).toEqual([]);
	});

	it("defaults to an empty array when the map is passed but has no entry for this asset id", () => {
		const imagesByAssetId = new Map<string, PropertyImageDto[]>([["some-other-asset", asset1Images]]);

		const result = mapActivityFeedMovement(makeMovementFixture(), imagesByAssetId);

		expect(result.property.images).toEqual([]);
	});
});

describe("mapActivityFeedDocumentRequest() — property.images", () => {
	it("populates property.images from the map when the engagement's asset id has an entry", () => {
		const imagesByAssetId = new Map<string, PropertyImageDto[]>([["asset-1", asset1Images]]);

		const result = mapActivityFeedDocumentRequest(makeDocumentRequestFixture(), imagesByAssetId);

		expect(result.property.images).toEqual(asset1Images);
	});

	it("defaults to an empty array when no imagesByAssetId map is passed at all (does not throw)", () => {
		const result = mapActivityFeedDocumentRequest(makeDocumentRequestFixture());

		expect(result.property.images).toEqual([]);
	});
});

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

	/**
	 * platform-role-change-activity — RED: ROLE_CHANGED case (T8)
	 *
	 * Spec: platform-role-change-activity — "Four-source merged activity feed"
	 *   scenario "Role-change events interleave correctly".
	 * Design §5: id prefix is `member-role-changed:<id>` (singular `member-`,
	 *   NOT `membership-`, per the proposal — breaks sibling prefix symmetry
	 *   deliberately; has zero functional impact on the tie-break comparator).
	 */
	it("maps a ROLE_CHANGED record with the member as subject and the changer as actor", () => {
		const record: MembershipActivityRecord = {
			event: "ROLE_CHANGED",
			id: "event-1",
			tenantId: "tenant-1",
			createdAt: new Date("2026-07-10T10:00:00.000Z"),
			subject: member,
			actor: deactivator,
			previousRole: "MANAGER",
			newRole: "AGENT",
		};

		const result = mapActivityFeedMembership(record);

		expect(result).toMatchObject({
			kind: "membership",
			id: "member-role-changed:event-1",
			tenantId: "tenant-1",
			createdAt: "2026-07-10T10:00:00.000Z",
			membershipEvent: "ROLE_CHANGED",
			subject: { id: member.id, email: member.email, firstName: member.firstName },
			actor: { id: deactivator.id, email: deactivator.email, firstName: deactivator.firstName },
			previousRole: "MANAGER",
			newRole: "AGENT",
		});
	});

	it("maps a ROLE_CHANGED record with a null actor when the actor could not be resolved", () => {
		const record: MembershipActivityRecord = {
			event: "ROLE_CHANGED",
			id: "event-2",
			tenantId: "tenant-1",
			createdAt: new Date("2026-07-11T10:00:00.000Z"),
			subject: member,
			actor: null,
			previousRole: "AGENT",
			newRole: "MANAGER",
		};

		const result = mapActivityFeedMembership(record);

		expect(result.actor).toBeNull();
	});
});
