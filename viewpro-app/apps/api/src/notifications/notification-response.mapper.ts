import {
	sanitizeInternalNotificationLink,
	sanitizeOwnerNotificationLink,
} from "./notification-link.helper";
import type {
	NotificationRecord,
	NotificationResponse,
} from "./notifications.repository";

export function mapNotificationResponse(
	notification: NotificationRecord,
): NotificationResponse {
	return mapNotificationResponseWithLink(
		notification,
		sanitizeInternalNotificationLink({
			linkHref: notification.linkHref,
			propertyEngagementId: notification.propertyEngagementId,
		}),
	);
}

export function mapOwnerNotificationResponse(
	notification: NotificationRecord,
): NotificationResponse {
	return mapNotificationResponseWithLink(
		notification,
		sanitizeOwnerNotificationLink({
			linkHref: notification.linkHref,
			propertyAssetId: notification.propertyAssetId,
		}),
	);
}

function mapNotificationResponseWithLink(
	notification: NotificationRecord,
	linkHref: string | null,
): NotificationResponse {
	return {
		id: notification.id,
		type: notification.type,
		surface: notification.surface,
		title: notification.title,
		body: notification.body,
		linkHref,
		readAt: notification.readAt?.toISOString() ?? null,
		createdAt: notification.createdAt.toISOString(),
		refs: {
			propertyEngagementId: notification.propertyEngagementId,
			propertyAssetId: notification.propertyAssetId,
			documentRequestId: notification.documentRequestId,
			movementId: notification.movementId,
		},
	};
}
