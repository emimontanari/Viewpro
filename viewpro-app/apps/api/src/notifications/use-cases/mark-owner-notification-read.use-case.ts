import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import { mapOwnerNotificationResponse } from "../notification-response.mapper";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationResponse,
	type NotificationsRepository,
} from "../notifications.repository";

@Injectable()
export class MarkOwnerNotificationReadUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(
		currentUser: CurrentUser,
		notificationId: string,
	): Promise<NotificationResponse> {
		const notification = await this.notificationsRepository.markOwnerRead({
			recipientUserId: currentUser.id,
			notificationId,
		});

		if (!notification) {
			throw new NotFoundException("Notification not found");
		}

		return mapOwnerNotificationResponse(notification);
	}
}
