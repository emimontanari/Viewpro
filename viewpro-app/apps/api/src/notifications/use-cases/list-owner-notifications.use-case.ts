import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import { mapOwnerNotificationResponse } from "../notification-response.mapper";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationResponse,
	type NotificationsRepository,
} from "../notifications.repository";
import type { ListNotificationsQuery } from "./list-notifications.use-case";

export type ListOwnerNotificationsResponse = {
	items: NotificationResponse[];
	total: number;
	page: number;
	pageSize: number;
};

@Injectable()
export class ListOwnerNotificationsUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(
		currentUser: CurrentUser,
		query: ListNotificationsQuery,
	): Promise<ListOwnerNotificationsResponse> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 20;
		const result = await this.notificationsRepository.listOwnerForRecipient({
			recipientUserId: currentUser.id,
			page,
			pageSize,
			unreadOnly: query.unreadOnly ?? false,
		});

		return {
			items: result.items.map(mapOwnerNotificationResponse),
			total: result.total,
			page,
			pageSize,
		};
	}
}
