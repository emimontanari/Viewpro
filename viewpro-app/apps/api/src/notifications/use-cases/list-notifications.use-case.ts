import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import { mapNotificationResponse } from "../notification-response.mapper";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationResponse,
	type NotificationsRepository,
} from "../notifications.repository";

export type ListNotificationsQuery = {
	page?: number;
	pageSize?: number;
	unreadOnly?: boolean;
};

export type ListNotificationsResponse = {
	items: NotificationResponse[];
	total: number;
	page: number;
	pageSize: number;
};

@Injectable()
export class ListNotificationsUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(
		tenant: TenantContext,
		currentUser: CurrentUser,
		query: ListNotificationsQuery,
	): Promise<ListNotificationsResponse> {
		const page = query.page ?? 1;
		const pageSize = query.pageSize ?? 20;
		const result = await this.notificationsRepository.listInternalForRecipient({
			tenantId: tenant.tenantId,
			recipientUserId: currentUser.id,
			page,
			pageSize,
			unreadOnly: query.unreadOnly ?? false,
		});

		return {
			items: result.items.map(mapNotificationResponse),
			total: result.total,
			page,
			pageSize,
		};
	}
}
