/**
 * Owner-Notifications API — end-to-end spec (Stage 24.5).
 *
 * Proves the OWNER notification surface against a real database.
 * Mirrors the structure of notifications.e2e-spec.ts (internal surface).
 *
 * Guard asymmetry note:
 * OwnerNotificationsController uses @UseGuards(AuthGuard) ONLY — no TenantMembershipGuard or
 * PermissionGuard. The 403 "Tenant context required" case from notifications.e2e-spec.ts has
 * no owner-surface equivalent. Omission is deliberate and documented here (FR-A9 parity / D6).
 *
 * Parity cross-check against notifications.e2e-spec.ts:
 * | Internal case                               | Owner equivalent here             |
 * |---------------------------------------------|-----------------------------------|
 * | 401 unauthenticated + 403 missing tenant     | S-A1 — 401 only (no tenant guard) |
 * | list scoped to tenant+recipient              | S-A2 — scoped to recipient+OWNER  |
 * | unread filter + count                        | S-A4, S-A9                        |
 * | mark-one own→200 / owner-surface→404         | S-A5 — own→200 (no cross-surface) |
 * | mark-one other-user→404                      | S-A6                              |
 * | mark-all + sanitize unsafe links             | S-A7 + S-A8                       |
 * | invalid query 400                            | S-A10 (DTO is shared)             |
 * | D1/D1b — active-owner-access filter          | S-A3, S-A3-D1b (OWNER-only)       |
 */

import {
	NotificationSurface,
	NotificationType,
	PropertyAssetOwnerAccessStatus,
	PropertyType,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

describe("Owner Notifications API endpoints (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		process.env.NODE_ENV = "test";
		process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret";
		process.env.COOKIE_DOMAIN = "localhost";
		process.env.COOKIE_SECURE = "false";

		app = await createApiApp();
		await app.init();
		prisma = app.get(PrismaService);
	});

	// Mirror the exact FK-ordered wipe from notifications.e2e-spec.ts:23-37.
	// propertyAssetOwner and propertyAsset are included here (R7 — FK-order / cascade).
	beforeEach(async () => {
		await prisma.notification.deleteMany();
		await prisma.documentVersion.deleteMany();
		await prisma.document.deleteMany();
		await prisma.documentRequest.deleteMany();
		await prisma.movement.deleteMany();
		await prisma.propertyAgent.deleteMany();
		await prisma.propertyEngagement.deleteMany();
		await prisma.propertyAssetOwner.deleteMany();
		await prisma.propertyAsset.deleteMany();
		await prisma.refreshToken.deleteMany();
		await prisma.tenantMembership.deleteMany();
		await prisma.tenant.deleteMany();
		await prisma.user.deleteMany();
	});

	afterAll(async () => {
		await app.close();
	});

	// S-A1 — Unauthenticated GET /api/owner/notifications returns 401.
	it("rejects unauthenticated requests with 401", async () => {
		await request(app.getHttpServer())
			.get("/api/owner/notifications")
			.expect(401);
	});

	// S-A2 — List scoped to recipient + OWNER surface; hides sensitive fields.
	// O1 has one OWNER-surface notification (ACTIVE access) + one INTERNAL-surface notification.
	// O2 has one OWNER-surface notification.
	// O1 fetch → total:1; only O1's OWNER notification; no tenantId/recipientUserId exposed.
	it("lists only recipient's OWNER-surface notifications and hides sensitive fields", async () => {
		const o1 = await registerTenantSession("owner-list-o1@example.com", "Owner List Tenant");
		const o2 = await registerTenantSession("owner-list-o2@example.com", "Owner List O2 Tenant");

		const assetA = await seedPropertyAsset(prisma, o1.userId);
		await linkOwner(prisma, assetA.id, o1.userId, PropertyAssetOwnerAccessStatus.ACTIVE);

		const visible = await seedNotification(prisma, {
			recipientUserId: o1.userId,
			surface: NotificationSurface.OWNER,
			title: "O1 visible OWNER notification",
			propertyAssetId: assetA.id,
		});

		// INTERNAL-surface notification for O1 — must NOT appear in owner list.
		await seedNotification(prisma, {
			recipientUserId: o1.userId,
			surface: NotificationSurface.INTERNAL,
			title: "O1 internal — excluded",
		});

		// O2's OWNER notification — must NOT appear for O1.
		const assetB = await seedPropertyAsset(prisma, o2.userId);
		await linkOwner(prisma, assetB.id, o2.userId, PropertyAssetOwnerAccessStatus.ACTIVE);
		await seedNotification(prisma, {
			recipientUserId: o2.userId,
			surface: NotificationSurface.OWNER,
			title: "O2 OWNER — excluded",
			propertyAssetId: assetB.id,
		});

		const response = await o1.agent
			.get("/api/owner/notifications")
			.expect(200);

		expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toMatchObject({
			id: visible.id,
			surface: NotificationSurface.OWNER,
			title: "O1 visible OWNER notification",
		});
		// FR-A10: sensitive fields must not be top-level response properties.
		expect(response.body.items[0]).not.toHaveProperty("tenantId");
		expect(response.body.items[0]).not.toHaveProperty("recipientUserId");
	});

	// S-A3 (D1 — CRITICAL) — active-owner-access filter: cross-property + inactive-REVOKED exclusion.
	// Two independent negative fixtures + one positive fixture. Real DB, not mocked.
	// FR-A3, FR-A3a (cross-property), FR-A3b (inactive REVOKED).
	it("excludes cross-property and inactive-REVOKED notifications from owner list and unread-count", async () => {
		const owner = await registerTenantSession(
			"owner-scope-o1@example.com",
			"Owner Scope Tenant",
		);
		const other = await registerTenantSession(
			"owner-scope-other@example.com",
			"Owner Scope Other Tenant",
		);

		// Asset A — recipient has ACTIVE access → notification MUST be returned.
		const assetA = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetA.id, owner.userId, PropertyAssetOwnerAccessStatus.ACTIVE);
		const nVisible = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-visible (ACTIVE access on A)",
			propertyAssetId: assetA.id,
		});

		// Asset B — recipient has REVOKED access → notification MUST be excluded (FR-A3b).
		const assetB = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetB.id, owner.userId, PropertyAssetOwnerAccessStatus.REVOKED);
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-revoked (REVOKED access on B)",
			propertyAssetId: assetB.id,
		});

		// Asset C — recipient has NO link at all; only OTHER user has ACTIVE access → excluded (FR-A3a).
		const assetC = await seedPropertyAsset(prisma, other.userId);
		await linkOwner(prisma, assetC.id, other.userId, PropertyAssetOwnerAccessStatus.ACTIVE);
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-other (cross-property on C, recipient has no link)",
			propertyAssetId: assetC.id,
		});

		const listResponse = await owner.agent
			.get("/api/owner/notifications")
			.expect(200);
		const countResponse = await owner.agent
			.get("/api/owner/notifications/unread-count")
			.expect(200);

		expect(listResponse.body.total).toBe(1);
		expect(listResponse.body.items).toHaveLength(1);
		expect(listResponse.body.items[0].id).toBe(nVisible.id);
		expect(countResponse.body).toEqual({ unreadCount: 1 });
	});

	// S-A3-D1b — Deeper-FK positive records: proves all four OR-guard relation paths resolve.
	// Seeds propertyEngagement, documentRequest, movement on asset A (ACTIVE) and asserts
	// all four OWNER notifications (asset-level + 3 deeper FKs) are returned.
	it("returns notifications via all four FK relation paths when owner has ACTIVE access (D1b)", async () => {
		const owner = await registerTenantSession(
			"owner-deep-fk@example.com",
			"Owner Deep FK Tenant",
		);

		const assetA = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetA.id, owner.userId, PropertyAssetOwnerAccessStatus.ACTIVE);

		// Asset-level FK notification (propertyAssetId set).
		const nAsset = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-asset FK",
			propertyAssetId: assetA.id,
		});

		// Create a tenant + engagement for the deeper FK fixtures (engagement requires tenantId).
		const engagement = await prisma.propertyEngagement.create({
			data: {
				tenantId: owner.tenantId,
				propertyAssetId: assetA.id,
				operationType: "SALE",
				createdByUserId: owner.userId,
			},
		});

		// propertyEngagementId FK notification.
		const nEngagement = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-engagement FK",
			propertyEngagementId: engagement.id,
		});

		// documentRequestId FK notification (DocumentRequest requires tenantId, engagement, requestedByUserId).
		const docRequest = await prisma.documentRequest.create({
			data: {
				tenantId: owner.tenantId,
				propertyEngagementId: engagement.id,
				requestedByUserId: owner.userId,
				title: "Test doc request",
			},
		});
		const nDocRequest = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-docRequest FK",
			documentRequestId: docRequest.id,
		});

		// movementId FK notification (Movement requires tenantId, engagement, createdByUserId, type, observation).
		const movement = await prisma.movement.create({
			data: {
				tenantId: owner.tenantId,
				propertyEngagementId: engagement.id,
				createdByUserId: owner.userId,
				type: "GENERAL_UPDATE",
				observation: "Test movement for D1b",
			},
		});
		const nMovement = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-movement FK",
			movementId: movement.id,
		});

		const response = await owner.agent
			.get("/api/owner/notifications")
			.expect(200);

		expect(response.body.total).toBe(4);
		const returnedIds = response.body.items.map((item: { id: string }) => item.id).sort();
		expect(returnedIds).toEqual(
			[nAsset.id, nEngagement.id, nDocRequest.id, nMovement.id].sort(),
		);
	});

	// S-A4 — Unread-count is scoped to OWNER surface only; INTERNAL-surface unread not counted.
	it("unread-count excludes INTERNAL-surface notifications from owner surface count", async () => {
		const owner = await registerTenantSession(
			"owner-unread-count@example.com",
			"Owner Unread Count Tenant",
		);

		const assetA = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetA.id, owner.userId, PropertyAssetOwnerAccessStatus.ACTIVE);

		// One OWNER-surface unread (ACTIVE access) — must be counted.
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "OWNER unread",
			readAt: null,
			propertyAssetId: assetA.id,
		});

		// One INTERNAL-surface unread — must NOT inflate owner unread-count.
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.INTERNAL,
			title: "INTERNAL unread — excluded from owner count",
			readAt: null,
		});

		const response = await owner.agent
			.get("/api/owner/notifications/unread-count")
			.expect(200);

		expect(response.body).toEqual({ unreadCount: 1 });
	});

	// S-A5 — Mark-one-read on own OWNER record returns 200 with readAt populated.
	it("marks own OWNER notification read and returns 200 with non-null readAt", async () => {
		const owner = await registerTenantSession(
			"owner-mark-one@example.com",
			"Owner Mark One Tenant",
		);

		const assetA = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetA.id, owner.userId, PropertyAssetOwnerAccessStatus.ACTIVE);

		const nOwn = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "Own OWNER unread",
			readAt: null,
			propertyAssetId: assetA.id,
		});

		const response = await owner.agent
			.post(`/api/owner/notifications/${nOwn.id}/read`)
			.expect(200);

		expect(response.body.id).toBe(nOwn.id);
		expect(response.body.readAt).toEqual(expect.any(String));
		expect(new Date(response.body.readAt).getTime()).not.toBeNaN();
	});

	// S-A6 — Mark-one-read on another recipient's OWNER record returns 404.
	it("returns 404 when marking another recipient's OWNER notification read", async () => {
		const o1 = await registerTenantSession(
			"owner-mark-o1@example.com",
			"Owner Mark O1 Tenant",
		);
		const o2 = await registerTenantSession(
			"owner-mark-o2@example.com",
			"Owner Mark O2 Tenant",
		);

		const assetB = await seedPropertyAsset(prisma, o2.userId);
		await linkOwner(prisma, assetB.id, o2.userId, PropertyAssetOwnerAccessStatus.ACTIVE);

		const nOther = await seedNotification(prisma, {
			recipientUserId: o2.userId,
			surface: NotificationSurface.OWNER,
			title: "O2 OWNER notification",
			propertyAssetId: assetB.id,
		});

		await o1.agent
			.post(`/api/owner/notifications/${nOther.id}/read`)
			.expect(404);
	});

	// S-A6b (D6) — Mark-one-read on the recipient's OWN record whose access is REVOKED returns 404.
	// Proves markOwnerRead enforces the same ownerScopeWhere access predicate on the mutation path
	// (not just the read path). Reuses the S-A3 inactive-REVOKED negative-fixture pattern.
	it("returns 404 when marking own OWNER notification read on a REVOKED-access property", async () => {
		const owner = await registerTenantSession(
			"owner-mark-revoked@example.com",
			"Owner Mark Revoked Tenant",
		);

		// Asset with REVOKED access for the authenticated owner → mark-read must be filtered out (404).
		const assetB = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetB.id, owner.userId, PropertyAssetOwnerAccessStatus.REVOKED);

		const nRevoked = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "Own OWNER notification on REVOKED-access property",
			readAt: null,
			propertyAssetId: assetB.id,
		});

		await owner.agent
			.post(`/api/owner/notifications/${nRevoked.id}/read`)
			.expect(404);
	});

	// S-A7 — Mark-all-read scopes to OWNER surface; INTERNAL notifications untouched.
	// FR-A7: updatedCount = 2 (OWNER records only), unread-count → 0, INTERNAL still readAt:null.
	it("marks all OWNER notifications read; INTERNAL surface records remain unread", async () => {
		const owner = await registerTenantSession(
			"owner-mark-all@example.com",
			"Owner Mark All Tenant",
		);

		const assetA = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetA.id, owner.userId, PropertyAssetOwnerAccessStatus.ACTIVE);
		const assetB = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(prisma, assetB.id, owner.userId, PropertyAssetOwnerAccessStatus.ACTIVE);

		// Two OWNER-surface unread with ACTIVE access.
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "OWNER unread 1",
			readAt: null,
			propertyAssetId: assetA.id,
		});
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "OWNER unread 2",
			readAt: null,
			propertyAssetId: assetB.id,
		});

		// One INTERNAL-surface unread — must remain unread after mark-all-read.
		const internalRecord = await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.INTERNAL,
			title: "INTERNAL unread — must stay unread",
			readAt: null,
		});

		const markAllResponse = await owner.agent
			.post("/api/owner/notifications/read-all")
			.expect(200);
		const countResponse = await owner.agent
			.get("/api/owner/notifications/unread-count")
			.expect(200);

		expect(markAllResponse.body).toEqual({ updatedCount: 2 });
		expect(countResponse.body).toEqual({ unreadCount: 0 });

		// INTERNAL record must still have readAt:null in the DB.
		const internalInDb = await prisma.notification.findUnique({
			where: { id: internalRecord.id },
		});
		expect(internalInDb?.readAt).toBeNull();
	});

	// S-A8 — Cross-surface link sanitization: dashboard-style and external links on OWNER records → null.
	// FR-A8: /dashboard/* paths are NOT in the sanitizeOwnerNotificationLink allowlist.
	// Asserts CURRENT 24.5 destinations; Stage 24.6 owns deep-link target changes.
	// Note: propertyAssetId is null here to isolate the link behavior from access-filter behavior.
	it("sanitizes cross-surface /dashboard/* and external links on OWNER records to null", async () => {
		const owner = await registerTenantSession(
			"owner-link-sanitize@example.com",
			"Owner Link Sanitize Tenant",
		);

		// Both records have null propertyAssetId (all FK guards short-circuit on null → pass).
		// Asserts CURRENT 24.5 destinations; Stage 24.6 owns deep-link target changes.
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-dashboard",
			linkHref: "/dashboard/product/some-engagement-id",
		});
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "N-unsafe external",
			linkHref: "https://external.example.com",
		});

		const response = await owner.agent
			.get("/api/owner/notifications")
			.expect(200);

		expect(response.body.total).toBe(2);
		for (const item of response.body.items) {
			expect(item.linkHref).toBeNull();
		}
	});

	// S-A9 — unreadOnly filter parity within owner scope.
	// One OWNER-surface unread + one OWNER-surface read (both with null FK → guards pass).
	// ?unreadOnly=true → total:1; ?unreadOnly=false → total:2.
	it("supports unreadOnly filter within owner scope", async () => {
		const owner = await registerTenantSession(
			"owner-unread-filter@example.com",
			"Owner Unread Filter Tenant",
		);

		// Both notifications have null propertyAssetId so all FK guards short-circuit.
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "OWNER unread",
			readAt: null,
		});
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "OWNER read",
			readAt: new Date("2026-01-01T00:00:00.000Z"),
		});

		const unreadResponse = await owner.agent
			.get("/api/owner/notifications")
			.query({ unreadOnly: "true" })
			.expect(200);
		const allResponse = await owner.agent
			.get("/api/owner/notifications")
			.query({ unreadOnly: "false" })
			.expect(200);

		expect(unreadResponse.body.total).toBe(1);
		expect(allResponse.body.total).toBe(2);
	});

	// S-A10 — Invalid query parameters are rejected with 400.
	// Uses the shared ListNotificationsQuery DTO (parity with internal spec invalid-query case).
	it("rejects invalid list query values with 400", async () => {
		const owner = await registerTenantSession(
			"owner-invalid-query@example.com",
			"Owner Invalid Query Tenant",
		);

		const badPagination = await owner.agent
			.get("/api/owner/notifications?page=0&pageSize=51")
			.expect(400);
		const badBoolean = await owner.agent
			.get("/api/owner/notifications?unreadOnly=maybe")
			.expect(400);

		expect(badPagination.body.message).toEqual(
			expect.arrayContaining([
				"page must not be less than 1",
				"pageSize must not be greater than 50",
			]),
		);
		expect(badBoolean.body.message).toEqual(
			expect.arrayContaining(["unreadOnly must be a boolean value"]),
		);
	});

	// ---------------------------------------------------------------------------
	// Stage 24.6a — Deep-link round-trip tests (S-P1, S-R1, S-R2, S-R3 backend layer)
	// ---------------------------------------------------------------------------

	// S-P1/S-P2/S-P3 — DOCUMENT_REQUESTED notification stores and returns deep-link linkHref.
	// Confirms sanitizeOwnerNotificationLink accepts the new ?tab=documents&doc={id} format.
	it("stores and returns deep-link linkHref for DOCUMENT_REQUESTED notification", async () => {
		const docReqId = "docreq-deeplink-1";
		const owner = await registerTenantSession(
			"owner-deeplink@example.com",
			"Owner Deep-Link Tenant",
		);
		const propertyAsset = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(
			prisma,
			propertyAsset.id,
			owner.userId,
			PropertyAssetOwnerAccessStatus.ACTIVE,
		);
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			type: NotificationType.DOCUMENT_REQUESTED,
			title: "Document requested deep-link",
			linkHref: `/owner/properties/${propertyAsset.id}?tab=documents&doc=${docReqId}`,
			propertyAssetId: propertyAsset.id,
		});

		const response = await owner.agent
			.get("/api/owner/notifications")
			.expect(200);

		expect(response.body.total).toBe(1);
		expect(response.body.items[0].linkHref).toBe(
			`/owner/properties/${propertyAsset.id}?tab=documents&doc=${docReqId}`,
		);
	});

	// S-R1 — Historical param-less /owner/properties/{assetId} linkHref still accepted.
	it("accepts historical param-less /owner/properties/{assetId} linkHref (S-R1 regression)", async () => {
		const owner = await registerTenantSession(
			"owner-r1-regression@example.com",
			"Owner R1 Regression Tenant",
		);
		const propertyAsset = await seedPropertyAsset(prisma, owner.userId);
		await linkOwner(
			prisma,
			propertyAsset.id,
			owner.userId,
			PropertyAssetOwnerAccessStatus.ACTIVE,
		);
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "Historical param-less notification",
			linkHref: `/owner/properties/${propertyAsset.id}`,
			propertyAssetId: propertyAsset.id,
		});

		const response = await owner.agent
			.get("/api/owner/notifications")
			.expect(200);

		expect(response.body.total).toBe(1);
		expect(response.body.items[0].linkHref).toBe(`/owner/properties/${propertyAsset.id}`);
	});

	// S-R2 — /owner root linkHref still accepted.
	it("accepts /owner root linkHref (S-R2 regression)", async () => {
		const owner = await registerTenantSession(
			"owner-r2-regression@example.com",
			"Owner R2 Regression Tenant",
		);
		await seedNotification(prisma, {
			recipientUserId: owner.userId,
			surface: NotificationSurface.OWNER,
			title: "Owner root notification",
			linkHref: "/owner",
		});

		const response = await owner.agent
			.get("/api/owner/notifications")
			.expect(200);

		expect(response.body.total).toBe(1);
		expect(response.body.items[0].linkHref).toBe("/owner");
	});

	// S-R3 / S-A8 — Cross-surface link sanitization assertion confirmed unchanged.
	// The existing S-A8 test above already covers this — no modification needed.

	// ---------------------------------------------------------------------------
	// Harness helpers (mirrored from notifications.e2e-spec.ts with owner extensions)
	// ---------------------------------------------------------------------------

	/**
	 * Registers a new user + tenant and returns an authenticated supertest agent.
	 * tenantId is incidental for the owner surface (owner scoping is by recipientUserId only),
	 * but it is returned for tests that need to create tenant-scoped entities (e.g. PropertyEngagement).
	 * Mirror of notifications.e2e-spec.ts:301.
	 */
	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({
				email,
				password: "password123",
				firstName: "Owner",
				tenantName,
			})
			.expect(201);

		return {
			agent,
			userId: response.body.user.id as string,
			tenantId: response.body.memberships[0].tenant.id as string,
		};
	}
});

/**
 * Seeds a Notification row. Extends the internal seedNotification helper to accept
 * owner-surface FK fields (propertyAssetId, propertyEngagementId, documentRequestId, movementId).
 * All FK fields default to null.
 */
function seedNotification(
	prisma: PrismaService,
	input: {
		recipientUserId: string;
		surface?: NotificationSurface;
		type?: NotificationType;
		title: string;
		body?: string | null;
		linkHref?: string | null;
		readAt?: Date | null;
		createdAt?: Date;
		propertyAssetId?: string | null;
		propertyEngagementId?: string | null;
		documentRequestId?: string | null;
		movementId?: string | null;
	},
) {
	return prisma.notification.create({
		data: {
			tenantId: null,
			recipientUserId: input.recipientUserId,
			surface: input.surface ?? NotificationSurface.OWNER,
			type: input.type ?? NotificationType.DOCUMENT_REQUESTED,
			title: input.title,
			body: input.body ?? null,
			linkHref: input.linkHref ?? null,
			readAt: input.readAt ?? null,
			createdAt: input.createdAt,
			propertyAssetId: input.propertyAssetId ?? null,
			propertyEngagementId: input.propertyEngagementId ?? null,
			documentRequestId: input.documentRequestId ?? null,
			movementId: input.movementId ?? null,
		},
	});
}

/**
 * Creates a minimal PropertyAsset for testing ownerScopeWhere FK guards.
 * Required fields: title, addressLine, city, province, propertyType, createdByUserId.
 */
function seedPropertyAsset(prisma: PrismaService, createdByUserId: string) {
	return prisma.propertyAsset.create({
		data: {
			title: "Test Property",
			addressLine: "123 Test St",
			city: "Córdoba",
			province: "Córdoba",
			propertyType: PropertyType.HOUSE,
			createdByUserId,
		},
	});
}

/**
 * Creates a PropertyAssetOwner row linking userId to propertyAssetId with the given accessStatus.
 * Respects @@unique([propertyAssetId, userId]).
 */
function linkOwner(
	prisma: PrismaService,
	propertyAssetId: string,
	userId: string,
	accessStatus: PropertyAssetOwnerAccessStatus,
) {
	return prisma.propertyAssetOwner.create({
		data: {
			propertyAssetId,
			userId,
			ownerEmail: `owner-${userId}@example.com`,
			ownerFirstName: "Test",
			ownerLastName: "Owner",
			accessStatus,
		},
	});
}
