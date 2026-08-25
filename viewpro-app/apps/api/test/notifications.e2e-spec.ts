import {
	NotificationSurface,
	NotificationType,
	PropertyType,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

describe("Notifications internal endpoints (e2e)", () => {
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

	it("rejects unauthenticated and missing tenant-context requests", async () => {
		await request(app.getHttpServer()).get("/api/notifications").expect(401);

		const manager = await registerTenantSession(
			"notifications-missing-tenant@example.com",
			"Notifications Missing Tenant",
		);

		const response = await manager.agent.get("/api/notifications").expect(403);

		expect(response.body.message).toBe("Tenant context required");
	});

	it("lists only current tenant recipient internal notifications", async () => {
		const manager = await registerTenantSession(
			"notifications-list-manager@example.com",
			"Notifications List Tenant",
		);
		const otherRecipient = await registerTenantSession(
			"notifications-list-peer@example.com",
			"Notifications List Peer Tenant",
		);
		const otherTenant = await registerTenantSession(
			"notifications-list-other@example.com",
			"Notifications List Other Tenant",
		);
		const visible = await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Visible notification",
			linkHref: "/dashboard",
			createdAt: new Date("2026-06-01T12:00:00.000Z"),
		});
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			surface: NotificationSurface.OWNER,
			title: "Owner notification",
		});
		await seedNotification({
			tenantId: otherTenant.tenantId,
			recipientUserId: manager.userId,
			title: "Cross tenant notification",
		});
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: otherRecipient.userId,
			title: "Other recipient notification",
		});

		const response = await manager.agent
			.get("/api/notifications")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body).toMatchObject({ total: 1, page: 1, pageSize: 20 });
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toMatchObject({
			id: visible.id,
			type: NotificationType.DOCUMENT_UPLOADED,
			surface: NotificationSurface.INTERNAL,
			title: "Visible notification",
			linkHref: "/dashboard",
			readAt: null,
			refs: {
				propertyEngagementId: null,
				propertyAssetId: null,
				documentRequestId: null,
				movementId: null,
			},
		});
		expect(response.body.items[0]).not.toHaveProperty("tenantId");
		expect(response.body.items[0]).not.toHaveProperty("recipientUserId");
	});

	it("supports unread filtering and unread count with strict internal scope", async () => {
		const manager = await registerTenantSession(
			"notifications-unread-manager@example.com",
			"Notifications Unread Tenant",
		);
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Unread internal",
			readAt: null,
		});
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Read internal",
			readAt: new Date("2026-06-01T12:00:00.000Z"),
		});
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			surface: NotificationSurface.OWNER,
			title: "Unread owner",
			readAt: null,
		});

		const unreadList = await manager.agent
			.get("/api/notifications")
			.query({ unreadOnly: "true" })
			.set("x-tenant-id", manager.tenantId)
			.expect(200);
		const allList = await manager.agent
			.get("/api/notifications")
			.query({ unreadOnly: "false" })
			.set("x-tenant-id", manager.tenantId)
			.expect(200);
		const count = await manager.agent
			.get("/api/notifications/unread-count")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(unreadList.body.total).toBe(1);
		expect(
			unreadList.body.items.map((item: { title: string }) => item.title),
		).toEqual(["Unread internal"]);
		expect(allList.body.total).toBe(2);
		expect(
			allList.body.items.map((item: { title: string }) => item.title).sort(),
		).toEqual(["Read internal", "Unread internal"]);
		expect(count.body).toEqual({ unreadCount: 1 });
	});

	it("marks one notification read only within current tenant recipient internal scope", async () => {
		const manager = await registerTenantSession(
			"notifications-mark-manager@example.com",
			"Notifications Mark Tenant",
		);
		const otherRecipient = await registerTenantSession(
			"notifications-mark-peer@example.com",
			"Notifications Mark Peer Tenant",
		);
		const own = await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Own unread",
			readAt: null,
		});
		const ownerSurface = await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			surface: NotificationSurface.OWNER,
			title: "Owner unread",
			readAt: null,
		});
		const otherUser = await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: otherRecipient.userId,
			title: "Other user unread",
			readAt: null,
		});

		const response = await manager.agent
			.post(`/api/notifications/${own.id}/read`)
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.id).toBe(own.id);
		expect(response.body.readAt).toEqual(expect.any(String));
		await manager.agent
			.post(`/api/notifications/${ownerSurface.id}/read`)
			.set("x-tenant-id", manager.tenantId)
			.expect(404);
		await manager.agent
			.post(`/api/notifications/${otherUser.id}/read`)
			.set("x-tenant-id", manager.tenantId)
			.expect(404);
	});

	it("marks all scoped internal notifications read and sanitizes unsafe links", async () => {
		const manager = await registerTenantSession(
			"notifications-read-all-manager@example.com",
			"Notifications Read All Tenant",
		);
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Unsafe owner link",
			linkHref: "/owner/properties/property-1",
			readAt: null,
		});
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Unsafe external link",
			linkHref: "https://example.com",
			readAt: null,
		});
		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			surface: NotificationSurface.OWNER,
			title: "Owner unread",
			readAt: null,
		});

		const listBefore = await manager.agent
			.get("/api/notifications")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);
		expect(
			listBefore.body.items.map(
				(item: { linkHref: string | null }) => item.linkHref,
			),
		).toEqual([null, null]);

		const response = await manager.agent
			.post("/api/notifications/read-all")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);
		const countAfter = await manager.agent
			.get("/api/notifications/unread-count")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body).toEqual({ updatedCount: 2 });
		expect(countAfter.body).toEqual({ unreadCount: 0 });
		await expect(
			prisma.notification.count({
				where: {
					tenantId: manager.tenantId,
					recipientUserId: manager.userId,
					surface: NotificationSurface.OWNER,
					readAt: null,
				},
			}),
		).resolves.toBe(1);
	});

	it("S-P1/S-P2 round-trip: DOCUMENT_UPLOADED stores and returns deep-link linkHref verbatim", async () => {
		const manager = await registerTenantSession(
			"notifications-deeplink-manager@example.com",
			"Notifications Deep-link Tenant",
		);

		// Create the FK chain: PropertyAsset → PropertyEngagement → Notification.
		const asset = await prisma.propertyAsset.create({
			data: {
				title: "Deep-link Test Property",
				addressLine: "123 Test St",
				city: "Test City",
				province: "Test Province",
				propertyType: PropertyType.HOUSE,
				createdByUserId: manager.userId,
			},
		});
		const engagement = await prisma.propertyEngagement.create({
			data: {
				tenantId: manager.tenantId,
				propertyAssetId: asset.id,
				operationType: "SALE",
				createdByUserId: manager.userId,
			},
		});

		const deepLinkHref = `/dashboard/product/${engagement.id}?doc=req-deep-1`;

		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Document uploaded deep-link",
			linkHref: deepLinkHref,
			propertyEngagementId: engagement.id,
		});

		const response = await manager.agent
			.get("/api/notifications")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.total).toBe(1);
		// S-P1/S-P2: sanitizer accepts the deep-link and returns it verbatim.
		expect(response.body.items[0].linkHref).toBe(deepLinkHref);
	});

	it("S-R1 regression: param-less /dashboard/product/{engId} linkHref still accepted", async () => {
		const manager = await registerTenantSession(
			"notifications-paramless-manager@example.com",
			"Notifications Param-less Tenant",
		);

		// Create the FK chain for propertyEngagementId.
		const asset = await prisma.propertyAsset.create({
			data: {
				title: "Param-less Test Property",
				addressLine: "456 Param St",
				city: "Test City",
				province: "Test Province",
				propertyType: PropertyType.HOUSE,
				createdByUserId: manager.userId,
			},
		});
		const engagement = await prisma.propertyEngagement.create({
			data: {
				tenantId: manager.tenantId,
				propertyAssetId: asset.id,
				operationType: "SALE",
				createdByUserId: manager.userId,
			},
		});

		const paramlessHref = `/dashboard/product/${engagement.id}`;

		await seedNotification({
			tenantId: manager.tenantId,
			recipientUserId: manager.userId,
			title: "Historical param-less notification",
			linkHref: paramlessHref,
			propertyEngagementId: engagement.id,
		});

		const response = await manager.agent
			.get("/api/notifications")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.total).toBe(1);
		// S-R1: historical param-less product path still sanitizes through.
		expect(response.body.items[0].linkHref).toBe(paramlessHref);
	});

	it("S-R2 regression: SAFE_INTERNAL_LINKS members pass through unchanged", async () => {
		const manager = await registerTenantSession(
			"notifications-safe-links-manager@example.com",
			"Notifications Safe Links Tenant",
		);
		const safeLinks = [
			"/dashboard",
			"/dashboard/seguimiento",
			"/dashboard/users",
			"/dashboard/status-change-requests",
		];

		// SAFE_INTERNAL_LINKS don't need propertyEngagementId — no FK required.
		for (const linkHref of safeLinks) {
			await seedNotification({
				tenantId: manager.tenantId,
				recipientUserId: manager.userId,
				title: `Safe link: ${linkHref}`,
				linkHref,
			});
		}

		const response = await manager.agent
			.get("/api/notifications")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.total).toBe(4);
		const returnedLinks = response.body.items
			.map((item: { linkHref: string | null }) => item.linkHref)
			.sort();
		expect(returnedLinks).toEqual(safeLinks.slice().sort());
	});

	it("rejects invalid list query values", async () => {
		const manager = await registerTenantSession(
			"notifications-invalid-query@example.com",
			"Notifications Invalid Query Tenant",
		);

		const response = await manager.agent
			.get("/api/notifications?page=0&pageSize=51")
			.set("x-tenant-id", manager.tenantId)
			.expect(400);
		const invalidBoolean = await manager.agent
			.get("/api/notifications?unreadOnly=maybe")
			.set("x-tenant-id", manager.tenantId)
			.expect(400);

		expect(response.body.message).toEqual(
			expect.arrayContaining([
				"page must not be less than 1",
				"pageSize must not be greater than 50",
			]),
		);
		expect(invalidBoolean.body.message).toEqual(
			expect.arrayContaining(["unreadOnly must be a boolean value"]),
		);
	});

	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({
				whatsappPhone: "3510000000",
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

	function seedNotification(input: {
		tenantId: string;
		recipientUserId: string;
		surface?: NotificationSurface;
		type?: NotificationType;
		title: string;
		body?: string | null;
		linkHref?: string | null;
		propertyEngagementId?: string | null;
		readAt?: Date | null;
		createdAt?: Date;
	}) {
		return prisma.notification.create({
			data: {
				tenantId: input.tenantId,
				recipientUserId: input.recipientUserId,
				surface: input.surface ?? NotificationSurface.INTERNAL,
				type: input.type ?? NotificationType.DOCUMENT_UPLOADED,
				title: input.title,
				body: input.body ?? null,
				linkHref: input.linkHref ?? null,
				propertyEngagementId: input.propertyEngagementId ?? null,
				readAt: input.readAt ?? null,
				createdAt: input.createdAt,
			},
		});
	}
});
