import { Inject, Injectable } from "@nestjs/common";
import type { CurrentUser } from "../../auth/types/current-user";
import type { TenantContext } from "../../tenant-context/tenant-context.types";
import {
	NOTIFICATIONS_REPOSITORY,
	type NotificationsRepository,
} from "../notifications.repository";

export type MarkAllNotificationsReadResponse = {
	updatedCount: number;
};

@Injectable()
export class MarkAllNotificationsReadUseCase {
	constructor(
		@Inject(NOTIFICATIONS_REPOSITORY)
		private readonly notificationsRepository: NotificationsRepository,
	) {}

	async execute(
		tenant: TenantContext,
		currentUser: CurrentUser,
	): Promise<MarkAllNotificationsReadResponse> {
		const updatedCount = await this.notificationsRepository.markAllInternalRead({
			tenantId: tenant.tenantId,
			recipientUserId: currentUser.id,
		});

		return { updatedCount };
	}
}
