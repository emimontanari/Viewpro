import { NotFoundException } from "@nestjs/common";
import { NotificationSurface, NotificationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { NotificationsRepository } from "../src/notifications/notifications.repository";
import { GetUnreadNotificationsCountUseCase } from "../src/notifications/use-cases/get-unread-notifications-count.use-case";
import { GetUnreadOwnerNotificationsCountUseCase } from "../src/notifications/use-cases/get-unread-owner-notifications-count.use-case";
import { ListNotificationsUseCase } from "../src/notifications/use-cases/list-notifications.use-case";
import { ListOwnerNotificationsUseCase } from "../src/notifications/use-cases/list-owner-notifications.use-case";
import { MarkAllNotificationsReadUseCase } from "../src/notifications/use-cases/mark-all-notifications-read.use-case";
import { MarkAllOwnerNotificationsReadUseCase } from "../src/notifications/use-cases/mark-all-owner-notifications-read.use-case";
import { MarkNotificationReadUseCase } from "../src/notifications/use-cases/mark-notification-read.use-case";
import { MarkOwnerNotificationReadUseCase } from "../src/notifications/use-cases/mark-owner-notification-read.use-case";

describe("Notifications use cases", () => {
	it("lists current tenant and user internal notifications", async () => {
		const notification = makeNotification();
		const repository = makeRepository({
			listInternalForRecipient: vi
				.fn()
				.mockResolvedValue({ items: [notification], total: 1 }),
		});
		const useCase = new ListNotificationsUseCase(repository);

		const result = await useCase.execute(makeTenant(), makeCurrentUser(), {
			page: 2,
			pageSize: 10,
			unreadOnly: true,
		});

		expect(repository.listInternalForRecipient).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			page: 2,
			pageSize: 10,
			unreadOnly: true,
		});
		expect(result).toEqual({
			items: [
				expect.objectContaining({
					id: "notification-1",
					linkHref: "/dashboard/product/engagement-1",
				}),
			],
			total: 1,
			page: 2,
			pageSize: 10,
		});
	});

	it("defaults list pagination", async () => {
		const repository = makeRepository({
			listInternalForRecipient: vi
				.fn()
				.mockResolvedValue({ items: [], total: 0 }),
		});
		const useCase = new ListNotificationsUseCase(repository);

		const result = await useCase.execute(makeTenant(), makeCurrentUser(), {});

		expect(repository.listInternalForRecipient).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			page: 1,
			pageSize: 20,
			unreadOnly: false,
		});
		expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
	});

	it("returns unread count for current tenant and user", async () => {
		const repository = makeRepository({
			countUnreadInternalForRecipient: vi.fn().mockResolvedValue(4),
		});
		const useCase = new GetUnreadNotificationsCountUseCase(repository);

		const result = await useCase.execute(makeTenant(), makeCurrentUser());

		expect(repository.countUnreadInternalForRecipient).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
		});
		expect(result).toEqual({ unreadCount: 4 });
	});

	it("marks one current tenant and user notification read", async () => {
		const notification = makeNotification({
			readAt: new Date("2026-06-01T12:00:00.000Z"),
		});
		const repository = makeRepository({
			markInternalRead: vi.fn().mockResolvedValue(notification),
		});
		const useCase = new MarkNotificationReadUseCase(repository);

		const result = await useCase.execute(
			makeTenant(),
			makeCurrentUser(),
			"notification-1",
		);

		expect(repository.markInternalRead).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
			notificationId: "notification-1",
		});
		expect(result).toEqual(
			expect.objectContaining({
				id: "notification-1",
				readAt: "2026-06-01T12:00:00.000Z",
			}),
		);
	});

	it("throws 404 when marking an inaccessible notification read", async () => {
		const repository = makeRepository({
			markInternalRead: vi.fn().mockResolvedValue(null),
		});
		const useCase = new MarkNotificationReadUseCase(repository);

		await expect(
			useCase.execute(makeTenant(), makeCurrentUser(), "missing"),
		).rejects.toThrow(new NotFoundException("Notification not found"));
	});

	it("marks all current tenant and user notifications read", async () => {
		const repository = makeRepository({
			markAllInternalRead: vi.fn().mockResolvedValue(2),
		});
		const useCase = new MarkAllNotificationsReadUseCase(repository);

		const result = await useCase.execute(makeTenant(), makeCurrentUser());

		expect(repository.markAllInternalRead).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			recipientUserId: "user-1",
		});
		expect(result).toEqual({ updatedCount: 2 });
	});

	it("lists current owner notifications", async () => {
		const notification = makeNotification({
			surface: NotificationSurface.OWNER,
			linkHref: "/owner/properties/property-1",
			propertyAssetId: "property-1",
		});
		const repository = makeRepository({
			listOwnerForRecipient: vi
				.fn()
				.mockResolvedValue({ items: [notification], total: 1 }),
		});
		const useCase = new ListOwnerNotificationsUseCase(repository);

		const result = await useCase.execute(makeCurrentUser(), {
			page: 2,
			pageSize: 10,
			unreadOnly: true,
		});

		expect(repository.listOwnerForRecipient).toHaveBeenCalledWith({
			recipientUserId: "user-1",
			page: 2,
			pageSize: 10,
			unreadOnly: true,
		});
		expect(result).toEqual({
			items: [
				expect.objectContaining({
					id: "notification-1",
					surface: NotificationSurface.OWNER,
					linkHref: "/owner/properties/property-1",
				}),
			],
			total: 1,
			page: 2,
			pageSize: 10,
		});
	});

	it("defaults owner list pagination", async () => {
		const repository = makeRepository({
			listOwnerForRecipient: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		});
		const useCase = new ListOwnerNotificationsUseCase(repository);

		const result = await useCase.execute(makeCurrentUser(), {});

		expect(repository.listOwnerForRecipient).toHaveBeenCalledWith({
			recipientUserId: "user-1",
			page: 1,
			pageSize: 20,
			unreadOnly: false,
		});
		expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
	});

	it("returns unread count for current owner", async () => {
		const repository = makeRepository({
			countUnreadOwnerForRecipient: vi.fn().mockResolvedValue(4),
		});
		const useCase = new GetUnreadOwnerNotificationsCountUseCase(repository);

		const result = await useCase.execute(makeCurrentUser());

		expect(repository.countUnreadOwnerForRecipient).toHaveBeenCalledWith({
			recipientUserId: "user-1",
		});
		expect(result).toEqual({ unreadCount: 4 });
	});

	it("marks one current owner notification read", async () => {
		const notification = makeNotification({
			surface: NotificationSurface.OWNER,
			readAt: new Date("2026-06-01T12:00:00.000Z"),
		});
		const repository = makeRepository({
			markOwnerRead: vi.fn().mockResolvedValue(notification),
		});
		const useCase = new MarkOwnerNotificationReadUseCase(repository);

		const result = await useCase.execute(makeCurrentUser(), "notification-1");

		expect(repository.markOwnerRead).toHaveBeenCalledWith({
			recipientUserId: "user-1",
			notificationId: "notification-1",
		});
		expect(result).toEqual(
			expect.objectContaining({
				id: "notification-1",
				readAt: "2026-06-01T12:00:00.000Z",
			}),
		);
	});

	it("throws 404 when marking an inaccessible owner notification read", async () => {
		const repository = makeRepository({
			markOwnerRead: vi.fn().mockResolvedValue(null),
		});
		const useCase = new MarkOwnerNotificationReadUseCase(repository);

		await expect(useCase.execute(makeCurrentUser(), "missing")).rejects.toThrow(
			new NotFoundException("Notification not found"),
		);
	});

	it("marks all current owner notifications read", async () => {
		const repository = makeRepository({
			markAllOwnerRead: vi.fn().mockResolvedValue(2),
		});
		const useCase = new MarkAllOwnerNotificationsReadUseCase(repository);

		const result = await useCase.execute(makeCurrentUser());

		expect(repository.markAllOwnerRead).toHaveBeenCalledWith({
			recipientUserId: "user-1",
		});
		expect(result).toEqual({ updatedCount: 2 });
	});
});

function makeRepository(
	overrides: Partial<NotificationsRepository> = {},
): NotificationsRepository {
	return {
		createInternal: vi.fn(),
		listInternalForRecipient: vi.fn(),
		countUnreadInternalForRecipient: vi.fn(),
		markInternalRead: vi.fn(),
		markAllInternalRead: vi.fn(),
		listOwnerForRecipient: vi.fn(),
		countUnreadOwnerForRecipient: vi.fn(),
		markOwnerRead: vi.fn(),
		markAllOwnerRead: vi.fn(),
		...overrides,
	} as NotificationsRepository;
}

function makeTenant() {
	return { tenantId: "tenant-1" } as never;
}

function makeCurrentUser() {
	return { id: "user-1", email: "agent@example.com" };
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
		linkHref: "/dashboard/product/engagement-1",
		propertyEngagementId: "engagement-1",
		propertyAssetId: null,
		documentRequestId: null,
		movementId: null,
		readAt: null,
		createdAt: new Date("2026-06-01T10:00:00.000Z"),
		...overrides,
	};
}
