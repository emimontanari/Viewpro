import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { NotificationProducerService } from "./notification-producer.service";
import { NotificationsController } from "./notifications.controller";
import { OwnerNotificationsController } from "./owner-notifications.controller";
import { NOTIFICATIONS_REPOSITORY } from "./notifications.repository";
import { PrismaNotificationsRepository } from "./prisma-notifications.repository";
import { GetUnreadNotificationsCountUseCase } from "./use-cases/get-unread-notifications-count.use-case";
import { GetUnreadOwnerNotificationsCountUseCase } from "./use-cases/get-unread-owner-notifications-count.use-case";
import { ListNotificationsUseCase } from "./use-cases/list-notifications.use-case";
import { ListOwnerNotificationsUseCase } from "./use-cases/list-owner-notifications.use-case";
import { MarkAllNotificationsReadUseCase } from "./use-cases/mark-all-notifications-read.use-case";
import { MarkAllOwnerNotificationsReadUseCase } from "./use-cases/mark-all-owner-notifications-read.use-case";
import { MarkNotificationReadUseCase } from "./use-cases/mark-notification-read.use-case";
import { MarkOwnerNotificationReadUseCase } from "./use-cases/mark-owner-notification-read.use-case";

@Module({
	imports: [
		AuthModule,
		MembershipsModule,
		PermissionsModule,
		TenantContextModule,
	],
	controllers: [NotificationsController, OwnerNotificationsController],
	providers: [
		{
			provide: NOTIFICATIONS_REPOSITORY,
			useClass: PrismaNotificationsRepository,
		},
		ListNotificationsUseCase,
		GetUnreadNotificationsCountUseCase,
		MarkNotificationReadUseCase,
		MarkAllNotificationsReadUseCase,
		ListOwnerNotificationsUseCase,
		GetUnreadOwnerNotificationsCountUseCase,
		MarkOwnerNotificationReadUseCase,
		MarkAllOwnerNotificationsReadUseCase,
		NotificationProducerService,
	],
	exports: [
		NOTIFICATIONS_REPOSITORY,
		NotificationProducerService,
		ListNotificationsUseCase,
		GetUnreadNotificationsCountUseCase,
		MarkNotificationReadUseCase,
		MarkAllNotificationsReadUseCase,
		ListOwnerNotificationsUseCase,
		GetUnreadOwnerNotificationsCountUseCase,
		MarkOwnerNotificationReadUseCase,
		MarkAllOwnerNotificationsReadUseCase,
	],
})
export class NotificationsModule {}
