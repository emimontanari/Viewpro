import { Controller, Get, HttpCode, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiExtraModels, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthGuard } from "../auth/guards/auth.guard";
import type { CurrentUser as CurrentUserContext } from "../auth/types/current-user";
import { PermissionGuard } from "../permissions/permission.guard";
import { PERMISSIONS } from "../permissions/permissions.constants";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ApiTenantContext } from "../tenant-context/tenant-context-api-docs.decorator";
import { CurrentTenant } from "../tenant-context/current-tenant.decorator";
import { TenantMembershipGuard } from "../tenant-context/tenant-membership.guard";
import type { TenantContext } from "../tenant-context/tenant-context.types";
import { ListNotificationsQuery } from "./dto/list-notifications.query";
import { GetUnreadNotificationsCountUseCase } from "./use-cases/get-unread-notifications-count.use-case";
import { ListNotificationsUseCase } from "./use-cases/list-notifications.use-case";
import { MarkAllNotificationsReadUseCase } from "./use-cases/mark-all-notifications-read.use-case";
import { MarkNotificationReadUseCase } from "./use-cases/mark-notification-read.use-case";

@Controller("notifications")
@ApiTags("Notifications")
@ApiExtraModels(ListNotificationsQuery)
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class NotificationsController {
	constructor(
		@Inject(ListNotificationsUseCase)
		private readonly listNotificationsUseCase: ListNotificationsUseCase,
		@Inject(GetUnreadNotificationsCountUseCase)
		private readonly getUnreadNotificationsCountUseCase: GetUnreadNotificationsCountUseCase,
		@Inject(MarkNotificationReadUseCase)
		private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
		@Inject(MarkAllNotificationsReadUseCase)
		private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
	) {}

	@Get()
	@ApiOperation({ summary: "List current-user notifications for the current tenant" })
	@RequirePermissions(PERMISSIONS.TENANT_VIEW)
	list(
		@CurrentTenant() tenant: TenantContext,
		@CurrentUser() currentUser: CurrentUserContext,
		@Query() query: ListNotificationsQuery,
	) {
		return this.listNotificationsUseCase.execute(tenant, currentUser, query);
	}

	@Get("unread-count")
	@ApiOperation({ summary: "Get current-user unread notification count for the current tenant" })
	@RequirePermissions(PERMISSIONS.TENANT_VIEW)
	unreadCount(
		@CurrentTenant() tenant: TenantContext,
		@CurrentUser() currentUser: CurrentUserContext,
	) {
		return this.getUnreadNotificationsCountUseCase.execute(tenant, currentUser);
	}

	@Post(":id/read")
	@HttpCode(200)
	@ApiOperation({ summary: "Mark a current-user tenant notification as read" })
	@RequirePermissions(PERMISSIONS.TENANT_VIEW)
	markRead(
		@CurrentTenant() tenant: TenantContext,
		@CurrentUser() currentUser: CurrentUserContext,
		@Param("id") id: string,
	) {
		return this.markNotificationReadUseCase.execute(tenant, currentUser, id);
	}

	@Post("read-all")
	@HttpCode(200)
	@ApiOperation({ summary: "Mark all current-user tenant notifications as read" })
	@RequirePermissions(PERMISSIONS.TENANT_VIEW)
	markAllRead(
		@CurrentTenant() tenant: TenantContext,
		@CurrentUser() currentUser: CurrentUserContext,
	) {
		return this.markAllNotificationsReadUseCase.execute(tenant, currentUser);
	}
}
