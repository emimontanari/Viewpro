import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationsRepository,
} from "../notifications.repository";
import type { UnreadNotificationsCountResponse } from "./get-unread-notifications-count.use-case";

@Injectable()
export class GetUnreadOwnerNotificationsCountUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(currentUser: CurrentUser): Promise<UnreadNotificationsCountResponse> {
		const unreadCount =
			await this.notificationsRepository.countUnreadOwnerForRecipient({
				recipientUserId: currentUser.id,
			});

		return { unreadCount };
	}
}
