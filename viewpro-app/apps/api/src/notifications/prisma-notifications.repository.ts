import { Inject, Injectable } from "@nestjs/common";
import { NotificationSurface, type Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type {
	CreateInternalNotificationInput,
	InternalNotificationScope,
	ListInternalNotificationsInput,
	ListOwnerNotificationsInput,
	MarkAllInternalNotificationsReadInput,
	MarkAllOwnerNotificationsReadInput,
	MarkInternalNotificationReadInput,
	MarkOwnerNotificationReadInput,
	NotificationRecord,
	NotificationsRepository,
	OwnerNotificationScope,
} from "./notifications.repository";

function internalScopeWhere(
	input: InternalNotificationScope,
): Prisma.NotificationWhereInput {
	return {
		tenantId: input.tenantId,
		recipientUserId: input.recipientUserId,
		surface: NotificationSurface.INTERNAL,
	};
}

function ownerScopeWhere(
	input: OwnerNotificationScope,
): Prisma.NotificationWhereInput {
	const activeOwnerAccess = {
		owners: {
			some: {
				userId: input.recipientUserId,
				accessStatus: "ACTIVE" as const,
			},
		},
	};

	return {
		recipientUserId: input.recipientUserId,
		surface: NotificationSurface.OWNER,
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
					{ documentRequest: { propertyEngagement: { propertyAsset: activeOwnerAccess } } },
				],
			},
			{
				OR: [
					{ movementId: null },
					{ movement: { propertyEngagement: { propertyAsset: activeOwnerAccess } } },
				],
			},
		],
	};
}

@Injectable()
export class PrismaNotificationsRepository implements NotificationsRepository {
	constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

	createInternal(
		input: CreateInternalNotificationInput,
	): Promise<NotificationRecord> {
		return this.prisma.notification.create({
			data: {
				tenantId: input.tenantId,
				recipientUserId: input.recipientUserId,
				surface: NotificationSurface.INTERNAL,
				type: input.type,
				title: input.title,
				body: input.body ?? null,
				linkHref: input.linkHref ?? null,
				propertyEngagementId: input.propertyEngagementId ?? null,
				propertyAssetId: input.propertyAssetId ?? null,
				documentRequestId: input.documentRequestId ?? null,
				movementId: input.movementId ?? null,
			},
		});
	}

	async listInternalForRecipient(
		input: ListInternalNotificationsInput,
	): Promise<{ items: NotificationRecord[]; total: number }> {
		const where = {
			...internalScopeWhere(input),
			...(input.unreadOnly ? { readAt: null } : {}),
		} satisfies Prisma.NotificationWhereInput;

		const [items, total] = await Promise.all([
			this.prisma.notification.findMany({
				where,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
			}),
			this.prisma.notification.count({ where }),
		]);

		return { items, total };
	}

	countUnreadInternalForRecipient(
		input: InternalNotificationScope,
	): Promise<number> {
		return this.prisma.notification.count({
			where: {
				...internalScopeWhere(input),
				readAt: null,
			},
		});
	}

	async markInternalRead(
		input: MarkInternalNotificationReadInput,
	): Promise<NotificationRecord | null> {
		const notification = await this.prisma.notification.findFirst({
			where: {
				id: input.notificationId,
				...internalScopeWhere(input),
			},
		});

		if (!notification) {
			return null;
		}

		if (notification.readAt) {
			return notification;
		}

		return this.prisma.notification.update({
			where: { id: notification.id },
			data: { readAt: input.readAt ?? new Date() },
		});
	}

	async markAllInternalRead(
		input: MarkAllInternalNotificationsReadInput,
	): Promise<number> {
		const result = await this.prisma.notification.updateMany({
			where: {
				...internalScopeWhere(input),
				readAt: null,
			},
			data: { readAt: input.readAt ?? new Date() },
		});

		return result.count;
	}

	async listOwnerForRecipient(
		input: ListOwnerNotificationsInput,
	): Promise<{ items: NotificationRecord[]; total: number }> {
		const where = {
			...ownerScopeWhere(input),
			...(input.unreadOnly ? { readAt: null } : {}),
		} satisfies Prisma.NotificationWhereInput;

		const [items, total] = await Promise.all([
			this.prisma.notification.findMany({
				where,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
			}),
			this.prisma.notification.count({ where }),
		]);

		return { items, total };
	}

	countUnreadOwnerForRecipient(
		input: OwnerNotificationScope,
	): Promise<number> {
		return this.prisma.notification.count({
			where: {
				...ownerScopeWhere(input),
				readAt: null,
			},
		});
	}

	async markOwnerRead(
		input: MarkOwnerNotificationReadInput,
	): Promise<NotificationRecord | null> {
		const notification = await this.prisma.notification.findFirst({
			where: {
				...ownerScopeWhere(input),
				id: input.notificationId,
			},
		});

		if (!notification) {
			return null;
		}

		if (notification.readAt) {
			return notification;
		}

		return this.prisma.notification.update({
			where: { id: notification.id },
			data: { readAt: input.readAt ?? new Date() },
		});
	}

	async markAllOwnerRead(
		input: MarkAllOwnerNotificationsReadInput,
	): Promise<number> {
		const result = await this.prisma.notification.updateMany({
			where: {
				...ownerScopeWhere(input),
				readAt: null,
			},
			data: { readAt: input.readAt ?? new Date() },
		});

		return result.count;
	}
}
