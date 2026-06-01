import { sanitizeInternalNotificationLink } from "./notification-link.helper";
import type {
	NotificationRecord,
	NotificationResponse,
} from "./notifications.repository";

export function mapNotificationResponse(
	notification: NotificationRecord,
): NotificationResponse {
	return {
		id: notification.id,
		type: notification.type,
		surface: notification.surface,
		title: notification.title,
		body: notification.body,
		linkHref: sanitizeInternalNotificationLink({
			linkHref: notification.linkHref,
			propertyEngagementId: notification.propertyEngagementId,
		}),
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
