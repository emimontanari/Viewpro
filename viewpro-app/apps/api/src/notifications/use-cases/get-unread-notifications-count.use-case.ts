import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationsRepository,
} from "../notifications.repository";

export type UnreadNotificationsCountResponse = {
	unreadCount: number;
};

@Injectable()
export class GetUnreadNotificationsCountUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(
		tenant: TenantContext,
		currentUser: CurrentUser,
	): Promise<UnreadNotificationsCountResponse> {
		const unreadCount =
			await this.notificationsRepository.countUnreadInternalForRecipient({
				tenantId: tenant.tenantId,
				recipientUserId: currentUser.id,
			});

		return { unreadCount };
	}
}
