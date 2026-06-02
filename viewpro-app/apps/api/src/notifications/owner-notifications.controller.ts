import {
	Controller,
	Get,
	HttpCode,
	Inject,
	Param,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import type { CurrentUser as CurrentUserContext } from "../auth/types/current-user";
import { ListNotificationsQuery } from "./dto/list-notifications.query";
import { GetUnreadOwnerNotificationsCountUseCase } from "./use-cases/get-unread-owner-notifications-count.use-case";
import { ListOwnerNotificationsUseCase } from "./use-cases/list-owner-notifications.use-case";
import { MarkAllOwnerNotificationsReadUseCase } from "./use-cases/mark-all-owner-notifications-read.use-case";
import { MarkOwnerNotificationReadUseCase } from "./use-cases/mark-owner-notification-read.use-case";

@Controller("owner/notifications")
@ApiTags("Owner notifications")
@ApiExtraModels(ListNotificationsQuery)
@UseGuards(AuthGuard)
export class OwnerNotificationsController {
	constructor(
		@Inject(ListOwnerNotificationsUseCase)
		private readonly listOwnerNotificationsUseCase: ListOwnerNotificationsUseCase,
		@Inject(GetUnreadOwnerNotificationsCountUseCase)
		private readonly getUnreadOwnerNotificationsCountUseCase: GetUnreadOwnerNotificationsCountUseCase,
		@Inject(MarkOwnerNotificationReadUseCase)
		private readonly markOwnerNotificationReadUseCase: MarkOwnerNotificationReadUseCase,
		@Inject(MarkAllOwnerNotificationsReadUseCase)
		private readonly markAllOwnerNotificationsReadUseCase: MarkAllOwnerNotificationsReadUseCase,
	) {}

	@Get()
	@ApiOperation({ summary: "List current-owner notifications" })
	list(
		@CurrentUser() currentUser: CurrentUserContext,
		@Query() query: ListNotificationsQuery,
	) {
		return this.listOwnerNotificationsUseCase.execute(currentUser, query);
	}

	@Get("unread-count")
	@ApiOperation({ summary: "Get current-owner unread notification count" })
	unreadCount(@CurrentUser() currentUser: CurrentUserContext) {
		return this.getUnreadOwnerNotificationsCountUseCase.execute(currentUser);
	}

	@Post(":id/read")
	@HttpCode(200)
	@ApiOperation({ summary: "Mark a current-owner notification as read" })
	markRead(
		@CurrentUser() currentUser: CurrentUserContext,
		@Param("id") id: string,
	) {
		return this.markOwnerNotificationReadUseCase.execute(currentUser, id);
	}

	@Post("read-all")
	@HttpCode(200)
	@ApiOperation({ summary: "Mark all current-owner notifications as read" })
	markAllRead(@CurrentUser() currentUser: CurrentUserContext) {
		return this.markAllOwnerNotificationsReadUseCase.execute(currentUser);
	}
}
