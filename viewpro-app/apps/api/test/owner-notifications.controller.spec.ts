import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../src/auth/guards/auth.guard";
import { PermissionGuard } from "../src/permissions/permission.guard";
import { TenantMembershipGuard } from "../src/tenant-context/tenant-membership.guard";
import { ListNotificationsQuery } from "../src/notifications/dto/list-notifications.query";
import { OwnerNotificationsController } from "../src/notifications/owner-notifications.controller";

const currentUser = {
	id: "owner-1",
	email: "owner@example.com",
};

describe("OwnerNotificationsController", () => {
	it("uses auth guard without tenant membership or permission guards", () => {
		const reflect = Reflect as typeof Reflect & {
			getMetadata: (metadataKey: string, target: object) => unknown[];
		};

		const guards = reflect.getMetadata(
			GUARDS_METADATA,
			OwnerNotificationsController,
		);

		expect(guards).toEqual([AuthGuard]);
		expect(guards).not.toContain(TenantMembershipGuard);
		expect(guards).not.toContain(PermissionGuard);
	});

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
			OwnerNotificationsController.prototype,
			"list",
		);

		expect(paramTypes[1]).toBe(ListNotificationsQuery);
	});

	it("forwards owner list requests to the list use case", async () => {
		const listOwnerNotificationsUseCase = {
			execute: vi
				.fn()
				.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 }),
		};
		const controller = makeController({ listOwnerNotificationsUseCase });
		const query = { page: 2, pageSize: 10, unreadOnly: true };

		const result = await controller.list(currentUser, query);

		expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
		expect(listOwnerNotificationsUseCase.execute).toHaveBeenCalledWith(
			currentUser,
			query,
		);
	});

	it("forwards owner unread count requests to the count use case", async () => {
		const getUnreadOwnerNotificationsCountUseCase = {
			execute: vi.fn().mockResolvedValue({ unreadCount: 3 }),
		};
		const controller = makeController({
			getUnreadOwnerNotificationsCountUseCase,
		});

		const result = await controller.unreadCount(currentUser);

		expect(result).toEqual({ unreadCount: 3 });
		expect(
			getUnreadOwnerNotificationsCountUseCase.execute,
		).toHaveBeenCalledWith(currentUser);
	});

	it("forwards owner mark-one-read requests to the mark use case", async () => {
		const markOwnerNotificationReadUseCase = {
			execute: vi.fn().mockResolvedValue({ id: "notification-1" }),
		};
		const controller = makeController({ markOwnerNotificationReadUseCase });

		const result = await controller.markRead(currentUser, "notification-1");

		expect(result).toEqual({ id: "notification-1" });
		expect(markOwnerNotificationReadUseCase.execute).toHaveBeenCalledWith(
			currentUser,
			"notification-1",
		);
	});

	it("forwards owner mark-all-read requests to the mark-all use case", async () => {
		const markAllOwnerNotificationsReadUseCase = {
			execute: vi.fn().mockResolvedValue({ updatedCount: 2 }),
		};
		const controller = makeController({ markAllOwnerNotificationsReadUseCase });

		const result = await controller.markAllRead(currentUser);

		expect(result).toEqual({ updatedCount: 2 });
		expect(markAllOwnerNotificationsReadUseCase.execute).toHaveBeenCalledWith(
			currentUser,
		);
	});
});

function makeController(overrides: Partial<Record<string, unknown>> = {}) {
	return new OwnerNotificationsController(
		(overrides.listOwnerNotificationsUseCase ?? { execute: vi.fn() }) as never,
		(overrides.getUnreadOwnerNotificationsCountUseCase ?? {
			execute: vi.fn(),
		}) as never,
		(overrides.markOwnerNotificationReadUseCase ?? {
			execute: vi.fn(),
		}) as never,
		(overrides.markAllOwnerNotificationsReadUseCase ?? {
			execute: vi.fn(),
		}) as never,
	);
}
