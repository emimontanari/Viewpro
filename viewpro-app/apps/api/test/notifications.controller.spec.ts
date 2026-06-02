import { describe, expect, it, vi } from "vitest";
import { ListNotificationsQuery } from "../src/notifications/dto/list-notifications.query";
import { NotificationsController } from "../src/notifications/notifications.controller";

const tenant = {
	tenantId: "tenant-1",
	tenantSlug: "tenant-one",
	tenantStatus: "TRIAL",
	membershipId: "membership-1",
	role: "MANAGER",
	permissions: ["tenant.view"],
	userStatus: "ACTIVE",
} as never;

const currentUser = {
	id: "user-1",
	email: "manager@example.com",
};

describe("NotificationsController", () => {
	it("keeps list query DTO runtime metadata for validation", () => {
		const reflect = Reflect as typeof Reflect & {
			getMetadata: (
				metadataKey: string,
				target: object,
				propertyKey: string,
			) => unknown[];
		};

		const paramTypes = reflect.getMetadata(
			"design:paramtypes",
			NotificationsController.prototype,
			"list",
		);

		expect(paramTypes[2]).toBe(ListNotificationsQuery);
	});

	it("forwards list requests to the list use case", async () => {
		const listNotificationsUseCase = {
			execute: vi
				.fn()
				.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 }),
		};
		const controller = makeController({ listNotificationsUseCase });
		const query = { page: 2, pageSize: 10, unreadOnly: true };

		const result = await controller.list(tenant, currentUser, query);

		expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
		expect(listNotificationsUseCase.execute).toHaveBeenCalledWith(
			tenant,
			currentUser,
			query,
		);
	});

	it("forwards unread count requests to the count use case", async () => {
		const getUnreadNotificationsCountUseCase = {
			execute: vi.fn().mockResolvedValue({ unreadCount: 3 }),
		};
		const controller = makeController({ getUnreadNotificationsCountUseCase });

		const result = await controller.unreadCount(tenant, currentUser);

		expect(result).toEqual({ unreadCount: 3 });
		expect(getUnreadNotificationsCountUseCase.execute).toHaveBeenCalledWith(
			tenant,
			currentUser,
		);
	});

	it("forwards mark-one-read requests to the mark use case", async () => {
		const markNotificationReadUseCase = {
			execute: vi.fn().mockResolvedValue({ id: "notification-1" }),
		};
		const controller = makeController({ markNotificationReadUseCase });

		const result = await controller.markRead(
			tenant,
			currentUser,
			"notification-1",
		);

		expect(result).toEqual({ id: "notification-1" });
		expect(markNotificationReadUseCase.execute).toHaveBeenCalledWith(
			tenant,
			currentUser,
			"notification-1",
		);
	});

	it("forwards mark-all-read requests to the mark-all use case", async () => {
		const markAllNotificationsReadUseCase = {
			execute: vi.fn().mockResolvedValue({ updatedCount: 2 }),
		};
		const controller = makeController({ markAllNotificationsReadUseCase });

		const result = await controller.markAllRead(tenant, currentUser);

		expect(result).toEqual({ updatedCount: 2 });
		expect(markAllNotificationsReadUseCase.execute).toHaveBeenCalledWith(
			tenant,
			currentUser,
		);
	});
});

function makeController(overrides: Partial<Record<string, unknown>> = {}) {
	return new NotificationsController(
		(overrides.listNotificationsUseCase ?? { execute: vi.fn() }) as never,
		(overrides.getUnreadNotificationsCountUseCase ?? {
			execute: vi.fn(),
		}) as never,
		(overrides.markNotificationReadUseCase ?? { execute: vi.fn() }) as never,
		(overrides.markAllNotificationsReadUseCase ?? {
			execute: vi.fn(),
		}) as never,
	);
}
