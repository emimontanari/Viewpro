import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { MovementsModule } from "../movements/movements.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { PROPERTY_ASSET_IMAGES_READ_REPOSITORY } from "../property-engagements/property-asset-images-read.repository";
import { PrismaPropertyAssetImagesReadRepository } from "../property-engagements/prisma-property-asset-images-read.repository";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsCoreModule } from "./analytics-core.module";
import { GetDashboardSummaryUseCase } from "./use-cases/get-dashboard-summary.use-case";
import { GetPilotSummaryUseCase } from "./use-cases/get-pilot-summary.use-case";
import { GetPlatformTenantActivityUseCase } from "./use-cases/get-platform-tenant-activity.use-case";
import { ListActivityFeedUseCase } from "./use-cases/list-activity-feed.use-case";
import { ListAnalyticsEventsUseCase } from "./use-cases/list-analytics-events.use-case";
import { ListInactiveEngagementsUseCase } from "./use-cases/list-inactive-engagements.use-case";

@Module({
	imports: [
		AnalyticsCoreModule,
		AuthModule,
		DocumentsModule,
		MembershipsModule,
		MovementsModule,
		PermissionsModule,
		TenantContextModule,
	],
	controllers: [AnalyticsController],
	providers: [
		GetPilotSummaryUseCase,
		GetDashboardSummaryUseCase,
		GetPlatformTenantActivityUseCase,
		ListActivityFeedUseCase,
		ListAnalyticsEventsUseCase,
		ListInactiveEngagementsUseCase,
		// operator-activity-media (Slice 1): GetPlatformTenantActivityUseCase now
		// depends on the batched property-image reader. This module provides that
		// use-case directly, so it must bind the reader too (mirrors
		// platform-data.module) — otherwise Nest can't resolve it here and the app
		// fails to bootstrap.
		{ provide: PROPERTY_ASSET_IMAGES_READ_REPOSITORY, useClass: PrismaPropertyAssetImagesReadRepository },
	],
	exports: [AnalyticsCoreModule, GetPilotSummaryUseCase, GetPlatformTenantActivityUseCase],
})
export class AnalyticsModule {}
