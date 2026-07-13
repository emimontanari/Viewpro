import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { ADMIN_READ_MODELS_REPOSITORY } from "./admin-read-models.repository";
import { AdminReadModelsService } from "./admin-read-models.service";
import { ADMIN_TENANT_LIMITS_REPOSITORY } from "./admin-tenant-limits.repository";
import { AdminTenantLimitsService } from "./admin-tenant-limits.service";
import { ADMIN_TENANT_STATUS_REPOSITORY } from "./admin-tenant-status.repository";
import { AdminTenantStatusService } from "./admin-tenant-status.service";
import { AdminController } from "./admin.controller";
import { GlobalAdminGuard } from "./guards/global-admin.guard";
import { PrismaAdminReadModelsRepository } from "./prisma-admin-read-models.repository";
import { PrismaAdminTenantLimitsRepository } from "./prisma-admin-tenant-limits.repository";
import { PrismaAdminTenantStatusRepository } from "./prisma-admin-tenant-status.repository";

@Module({
	imports: [AuthModule, UsersModule],
	controllers: [AdminController],
	providers: [
		GlobalAdminGuard,
		AdminReadModelsService,
		AdminTenantStatusService,
		AdminTenantLimitsService,
		{
			provide: ADMIN_READ_MODELS_REPOSITORY,
			useClass: PrismaAdminReadModelsRepository,
		},
		{
			provide: ADMIN_TENANT_STATUS_REPOSITORY,
			useClass: PrismaAdminTenantStatusRepository,
		},
		{
			provide: ADMIN_TENANT_LIMITS_REPOSITORY,
			useClass: PrismaAdminTenantLimitsRepository,
		},
	],
	exports: [
		AdminTenantStatusService,
		AdminTenantLimitsService,
		{
			provide: ADMIN_TENANT_STATUS_REPOSITORY,
			useClass: PrismaAdminTenantStatusRepository,
		},
		{
			provide: ADMIN_TENANT_LIMITS_REPOSITORY,
			useClass: PrismaAdminTenantLimitsRepository,
		},
	],
})
export class AdminModule {}
