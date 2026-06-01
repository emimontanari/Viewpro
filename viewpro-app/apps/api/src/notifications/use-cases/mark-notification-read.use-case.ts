import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import { mapNotificationResponse } from "../notification-response.mapper";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationResponse,
	type NotificationsRepository,
} from "../notifications.repository";

@Injectable()
export class MarkNotificationReadUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(
		tenant: TenantContext,
		currentUser: CurrentUser,
		notificationId: string,
	): Promise<NotificationResponse> {
		const notification = await this.notificationsRepository.markInternalRead({
			tenantId: tenant.tenantId,
			recipientUserId: currentUser.id,
			notificationId,
		});

		if (!notification) {
			throw new NotFoundException("Notification not found");
		}

		return mapNotificationResponse(notification);
	}
}
