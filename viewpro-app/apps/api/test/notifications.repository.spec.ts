import { NotificationSurface, NotificationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { sanitizeInternalNotificationLink } from "../src/notifications/notification-link.helper";
import {
	mapNotificationResponse,
	mapOwnerNotificationResponse,
} from "../src/notifications/notification-response.mapper";
import { PrismaNotificationsRepository } from "../src/notifications/prisma-notifications.repository";

describe("Notifications repository", () => {
	it("exposes notification enums from Prisma Client", () => {
		expect(NotificationSurface.INTERNAL).toBe("INTERNAL");
		expect(NotificationSurface.OWNER).toBe("OWNER");
		expect(NotificationType.DOCUMENT_REQUESTED).toBe("DOCUMENT_REQUESTED");
		expect(NotificationType.DOCUMENT_UPLOADED).toBe("DOCUMENT_UPLOADED");
		expect(NotificationType.DOCUMENT_APPROVED).toBe("DOCUMENT_APPROVED");
		expect(NotificationType.DOCUMENT_REJECTED).toBe("DOCUMENT_REJECTED");
		expect(NotificationType.PROPERTY_STATUS_CHANGED).toBe(
			"PROPERTY_STATUS_CHANGED",
		);
		expect(NotificationType.MOVEMENT_CREATED).toBe("MOVEMENT_CREATED");
	});

	it("creates internal notifications with scoped recipient and nullable refs", async () => {
		const notification = makeNotification({
			body: null,
			linkHref: null,
			propertyEngagementId: null,
			propertyAssetId: null,
			documentRequestId: null,
			movementId: null,
		});
		const create = vi.fn().mockResolvedValue(notification);
		const repository = new PrismaNotificationsRepository({
			notification: { create },
		} as never);

		const result = await repository.createInternal({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			type: NotificationType.DOCUMENT_UPLOADED,
			title: "New document uploaded",
		});

		expect(result).toEqual(notification);
		expect(create).toHaveBeenCalledWith({
			data: {
				tenantId: "tenant-1",
				recipientUserId: "user-1",
				surface: NotificationSurface.INTERNAL,
				type: NotificationType.DOCUMENT_UPLOADED,
				title: "New document uploaded",
				body: null,
				linkHref: null,
				propertyEngagementId: null,
				propertyAssetId: null,
				documentRequestId: null,
				movementId: null,
			},
		});
	});

	it("creates owner notifications with scoped recipient and nullable refs", async () => {
		const notification = makeNotification({
			surface: NotificationSurface.OWNER,
			type: NotificationType.DOCUMENT_REQUESTED,
			title: "Document requested",
			body: "Property deed",
			linkHref: "/owner/properties/property-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			documentRequestId: "request-1",
		});
		const create = vi.fn().mockResolvedValue(notification);
		const repository = new PrismaNotificationsRepository({
			notification: { create },
		} as never);

		const result = await repository.createOwner({
			tenantId: "tenant-1",
			recipientUserId: "owner-1",
			type: NotificationType.DOCUMENT_REQUESTED,
			title: "Document requested",
			body: "Property deed",
			linkHref: "/owner/properties/property-1",
			propertyEngagementId: "engagement-1",
			propertyAssetId: "property-1",
			documentRequestId: "request-1",
		});

		expect(result).toEqual(notification);
		expect(create).toHaveBeenCalledWith({
			data: {
				tenantId: "tenant-1",
				recipientUserId: "owner-1",
				surface: NotificationSurface.OWNER,
				type: NotificationType.DOCUMENT_REQUESTED,
				title: "Document requested",
				body: "Property deed",
				linkHref: "/owner/properties/property-1",
				propertyEngagementId: "engagement-1",
				propertyAssetId: "property-1",
				documentRequestId: "request-1",
				movementId: null,
			},
		});
	});

	it("lists only tenant, recipient, internal notifications", async () => {
		const notification = makeNotification();
		const findMany = vi.fn().mockResolvedValue([notification]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaNotificationsRepository({
			notification: { findMany, count },
		} as never);

		const result = await repository.listInternalForRecipient({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			page: 2,
			pageSize: 10,
			unreadOnly: false,
		});

		expect(result).toEqual({ items: [notification], total: 1 });
		expect(findMany).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				recipientUserId: "user-1",
				surface: NotificationSurface.INTERNAL,
			},
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			skip: 10,
			take: 10,
		});
		expect(count).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				recipientUserId: "user-1",
				surface: NotificationSurface.INTERNAL,
			},
		});
	});

	it("adds unread filtering when listing unread only", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const count = vi.fn().mockResolvedValue(0);
		const repository = new PrismaNotificationsRepository({
			notification: { findMany, count },
		} as never);

		await repository.listInternalForRecipient({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			page: 1,
			pageSize: 20,
			unreadOnly: true,
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ readAt: null }),
			}),
		);
		expect(count).toHaveBeenCalledWith({
			where: expect.objectContaining({ readAt: null }),
		});
	});

	it("counts unread tenant recipient internal notifications", async () => {
		const count = vi.fn().mockResolvedValue(3);
		const repository = new PrismaNotificationsRepository({
			notification: { count },
		} as never);

		const result = await repository.countUnreadInternalForRecipient({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
		});

		expect(result).toBe(3);
		expect(count).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				recipientUserId: "user-1",
				surface: NotificationSurface.INTERNAL,
				readAt: null,
			},
		});
	});

	it("marks one scoped unread notification read", async () => {
		const notification = makeNotification({ readAt: null });
		const readAt = new Date("2026-06-01T12:00:00.000Z");
		const findFirst = vi.fn().mockResolvedValue(notification);
		const update = vi.fn().mockResolvedValue({ ...notification, readAt });
		const repository = new PrismaNotificationsRepository({
			notification: { findFirst, update },
		} as never);

		const result = await repository.markInternalRead({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			notificationId: "notification-1",
			readAt,
		});

		expect(result?.readAt).toBe(readAt);
		expect(findFirst).toHaveBeenCalledWith({
			where: {
				id: "notification-1",
				tenantId: "tenant-1",
				recipientUserId: "user-1",
				surface: NotificationSurface.INTERNAL,
			},
		});
		expect(update).toHaveBeenCalledWith({
			where: { id: "notification-1" },
			data: { readAt },
		});
	});

	it("preserves readAt when marking an already-read notification", async () => {
		const readAt = new Date("2026-06-01T11:00:00.000Z");
		const notification = makeNotification({ readAt });
		const findFirst = vi.fn().mockResolvedValue(notification);
		const update = vi.fn();
		const repository = new PrismaNotificationsRepository({
			notification: { findFirst, update },
		} as never);

		const result = await repository.markInternalRead({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			notificationId: "notification-1",
			readAt: new Date("2026-06-01T12:00:00.000Z"),
		});

		expect(result).toEqual(notification);
		expect(update).not.toHaveBeenCalled();
	});

	it("returns null when marking an inaccessible notification read", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const update = vi.fn();
		const repository = new PrismaNotificationsRepository({
			notification: { findFirst, update },
		} as never);

		const result = await repository.markInternalRead({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			notificationId: "missing",
		});

		expect(result).toBeNull();
		expect(update).not.toHaveBeenCalled();
	});

	it("marks all scoped unread internal notifications read", async () => {
		const updateMany = vi.fn().mockResolvedValue({ count: 2 });
		const readAt = new Date("2026-06-01T12:00:00.000Z");
		const repository = new PrismaNotificationsRepository({
			notification: { updateMany },
		} as never);

		const result = await repository.markAllInternalRead({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			readAt,
		});

		expect(result).toBe(2);
		expect(updateMany).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				recipientUserId: "user-1",
				surface: NotificationSurface.INTERNAL,
				readAt: null,
			},
			data: { readAt },
		});
	});

	it("lists owner notifications with recipient, OWNER surface, and active owner access", async () => {
		const notification = makeNotification({
			surface: NotificationSurface.OWNER,
		});
		const findMany = vi.fn().mockResolvedValue([notification]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaNotificationsRepository({
			notification: { findMany, count },
		} as never);

		const result = await repository.listOwnerForRecipient({
			recipientUserId: "owner-1",
			page: 2,
			pageSize: 10,
			unreadOnly: true,
		});

		expect(result).toEqual({ items: [notification], total: 1 });
		const expectedWhere = ownerScopeWhere("owner-1", { readAt: null });
		expect(findMany).toHaveBeenCalledWith({
			where: expectedWhere,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			skip: 10,
			take: 10,
		});
		expect(count).toHaveBeenCalledWith({ where: expectedWhere });
	});

	it("counts unread owner notifications with active owner access", async () => {
		const count = vi.fn().mockResolvedValue(3);
		const repository = new PrismaNotificationsRepository({
			notification: { count },
		} as never);

		const result = await repository.countUnreadOwnerForRecipient({
			recipientUserId: "owner-1",
		});

		expect(result).toBe(3);
		expect(count).toHaveBeenCalledWith({
			where: ownerScopeWhere("owner-1", { readAt: null }),
		});
	});

	it("marks one owner notification read only within owner scope", async () => {
		const notification = makeNotification({
			surface: NotificationSurface.OWNER,
		});
		const readAt = new Date("2026-06-01T12:00:00.000Z");
		const findFirst = vi.fn().mockResolvedValue(notification);
		const update = vi.fn().mockResolvedValue({ ...notification, readAt });
		const repository = new PrismaNotificationsRepository({
			notification: { findFirst, update },
		} as never);

		const result = await repository.markOwnerRead({
			recipientUserId: "owner-1",
			notificationId: "notification-1",
			readAt,
		});

		expect(result?.readAt).toBe(readAt);
		expect(findFirst).toHaveBeenCalledWith({
			where: ownerScopeWhere("owner-1", { id: "notification-1" }),
		});
		expect(update).toHaveBeenCalledWith({
			where: { id: "notification-1" },
			data: { readAt },
		});
	});

	it("marks all owner notifications read only within owner scope", async () => {
		const updateMany = vi.fn().mockResolvedValue({ count: 2 });
		const readAt = new Date("2026-06-01T12:00:00.000Z");
		const repository = new PrismaNotificationsRepository({
			notification: { updateMany },
		} as never);

		const result = await repository.markAllOwnerRead({
			recipientUserId: "owner-1",
			readAt,
		});

		expect(result).toBe(2);
		expect(updateMany).toHaveBeenCalledWith({
			where: ownerScopeWhere("owner-1", { readAt: null }),
			data: { readAt },
		});
	});

	it("sanitizes internal notification links", () => {
		expect(sanitizeInternalNotificationLink({ linkHref: "/dashboard" })).toBe(
			"/dashboard",
		);
		expect(
			sanitizeInternalNotificationLink({ linkHref: "/dashboard/seguimiento" }),
		).toBe("/dashboard/seguimiento");
		expect(
			sanitizeInternalNotificationLink({ linkHref: "/dashboard/users" }),
		).toBe("/dashboard/users");
		expect(
			sanitizeInternalNotificationLink({
				linkHref: "/dashboard/product/engagement-1",
				propertyEngagementId: "engagement-1",
			}),
		).toBe("/dashboard/product/engagement-1");
		expect(
			sanitizeInternalNotificationLink({ linkHref: "/dashboard/product" }),
		).toBeNull();
		expect(
			sanitizeInternalNotificationLink({ linkHref: "/dashboard/billing" }),
		).toBeNull();
		expect(sanitizeInternalNotificationLink({ linkHref: "/owner" })).toBeNull();
		expect(
			sanitizeInternalNotificationLink({ linkHref: "https://example.com" }),
		).toBeNull();
	});

	it("maps safe notification responses without tenant or recipient ids", () => {
		const response = mapNotificationResponse(
			makeNotification({
				linkHref: "/dashboard/product/engagement-1",
				propertyEngagementId: "engagement-1",
			}),
		);

		expect(response).toEqual({
			id: "notification-1",
			type: NotificationType.DOCUMENT_UPLOADED,
			surface: NotificationSurface.INTERNAL,
			title: "New document uploaded",
			body: "A document is ready for review.",
			linkHref: "/dashboard/product/engagement-1",
			readAt: null,
			createdAt: "2026-06-01T10:00:00.000Z",
			refs: {
				propertyEngagementId: "engagement-1",
				propertyAssetId: null,
				documentRequestId: null,
				movementId: null,
			},
		});
		expect(response).not.toHaveProperty("tenantId");
		expect(response).not.toHaveProperty("recipientUserId");
	});

	it("nulls unsafe internal response links", () => {
		const response = mapNotificationResponse(
			makeNotification({ linkHref: "/owner/properties/property-1" }),
		);

		expect(response.linkHref).toBeNull();
	});

	it("maps only safe owner response links", () => {
		const safe = mapOwnerNotificationResponse(
			makeNotification({
				surface: NotificationSurface.OWNER,
				linkHref: "/owner/properties/property-1",
				propertyAssetId: "property-1",
			}),
		);
		const dashboard = mapOwnerNotificationResponse(
			makeNotification({
				surface: NotificationSurface.OWNER,
				linkHref: "/dashboard",
			}),
		);
		const external = mapOwnerNotificationResponse(
			makeNotification({
				surface: NotificationSurface.OWNER,
				linkHref: "https://example.com",
			}),
		);

		expect(safe.linkHref).toBe("/owner/properties/property-1");
		expect(dashboard.linkHref).toBeNull();
		expect(external.linkHref).toBeNull();
	});
});

function ownerScopeWhere(
	recipientUserId: string,
	extra: Record<string, unknown> = {},
) {
	const activeOwnerAccess = {
		owners: { some: { userId: recipientUserId, accessStatus: "ACTIVE" } },
	};

	return {
		recipientUserId,
		surface: NotificationSurface.OWNER,
		...extra,
		AND: [
			{
				OR: [{ propertyAssetId: null }, { propertyAsset: activeOwnerAccess }],
			},
			{
				OR: [
					{ propertyEngagementId: null },
					{ propertyEngagement: { propertyAsset: activeOwnerAccess } },
				],
			},
			{
				OR: [
					{ documentRequestId: null },
					{
						documentRequest: {
							propertyEngagement: { propertyAsset: activeOwnerAccess },
						},
					},
				],
			},
			{
				OR: [
					{ movementId: null },
					{
						movement: {
							propertyEngagement: { propertyAsset: activeOwnerAccess },
						},
					},
				],
			},
		],
	};
}

function makeNotification(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: "notification-1",
		tenantId: "tenant-1",
		recipientUserId: "user-1",
		surface: NotificationSurface.INTERNAL,
		type: NotificationType.DOCUMENT_UPLOADED,
		title: "New document uploaded",
		body: "A document is ready for review.",
		linkHref: null,
		propertyEngagementId: null,
		propertyAssetId: null,
		documentRequestId: null,
		movementId: null,
		readAt: null,
		createdAt: new Date("2026-06-01T10:00:00.000Z"),
		...overrides,
	};
}
