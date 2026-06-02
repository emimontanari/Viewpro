import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationsRepository,
} from "../notifications.repository";
import type { MarkAllNotificationsReadResponse } from "./mark-all-notifications-read.use-case";

@Injectable()
export class MarkAllOwnerNotificationsReadUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(currentUser: CurrentUser): Promise<MarkAllNotificationsReadResponse> {
		const updatedCount = await this.notificationsRepository.markAllOwnerRead({
			recipientUserId: currentUser.id,
		});

		return { updatedCount };
	}
}
