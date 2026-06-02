import type {
	NotificationSurface,
	NotificationType,
	Prisma,
} from "@prisma/client";

export const NOTIFICATIONS_REPOSITORY = Symbol("NOTIFICATIONS_REPOSITORY");

export type NotificationRecord = Prisma.NotificationGetPayload<{}>;

export type CreateInternalNotificationInput = {
	tenantId: string;
	recipientUserId: string;
	type: NotificationType;
	title: string;
	body?: string | null;
	linkHref?: string | null;
	propertyEngagementId?: string | null;
	propertyAssetId?: string | null;
	documentRequestId?: string | null;
	movementId?: string | null;
};

export type InternalNotificationScope = {
	tenantId: string;
	recipientUserId: string;
};

export type ListInternalNotificationsInput = InternalNotificationScope & {
	page: number;
	pageSize: number;
	unreadOnly: boolean;
};

export type MarkInternalNotificationReadInput = InternalNotificationScope & {
	notificationId: string;
	readAt?: Date;
};

export type MarkAllInternalNotificationsReadInput =
	InternalNotificationScope & {
		readAt?: Date;
	};

export type OwnerNotificationScope = {
	recipientUserId: string;
};

export type ListOwnerNotificationsInput = OwnerNotificationScope & {
	page: number;
	pageSize: number;
	unreadOnly: boolean;
};

export type MarkOwnerNotificationReadInput = OwnerNotificationScope & {
	notificationId: string;
	readAt?: Date;
};

export type MarkAllOwnerNotificationsReadInput = OwnerNotificationScope & {
	readAt?: Date;
};

export type NotificationsRepository = {
	createInternal(
		input: CreateInternalNotificationInput,
	): Promise<NotificationRecord>;
	listInternalForRecipient(input: ListInternalNotificationsInput): Promise<{
		items: NotificationRecord[];
		total: number;
	}>;
	countUnreadInternalForRecipient(
		input: InternalNotificationScope,
	): Promise<number>;
	markInternalRead(
		input: MarkInternalNotificationReadInput,
	): Promise<NotificationRecord | null>;
	markAllInternalRead(
		input: MarkAllInternalNotificationsReadInput,
	): Promise<number>;
	listOwnerForRecipient(input: ListOwnerNotificationsInput): Promise<{
		items: NotificationRecord[];
		total: number;
	}>;
	countUnreadOwnerForRecipient(input: OwnerNotificationScope): Promise<number>;
	markOwnerRead(
		input: MarkOwnerNotificationReadInput,
	): Promise<NotificationRecord | null>;
	markAllOwnerRead(input: MarkAllOwnerNotificationsReadInput): Promise<number>;
};

export type NotificationResponse = {
	id: string;
	type: NotificationType;
	surface: NotificationSurface;
	title: string;
	body: string | null;
	linkHref: string | null;
	readAt: string | null;
	createdAt: string;
	refs: {
		propertyEngagementId: string | null;
		propertyAssetId: string | null;
		documentRequestId: string | null;
		movementId: string | null;
	};
};
