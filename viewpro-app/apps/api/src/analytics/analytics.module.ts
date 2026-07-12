import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DocumentsModule } from "../documents/documents.module";
import { MembershipsModule } from "../memberships/memberships.module";
import { MovementsModule } from "../movements/movements.module";
import { PermissionsModule } from "../permissions/permissions.module";
import { TenantContextModule } from "../tenant-context/tenant-context.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsCoreModule } from "./analytics-core.module";
import { GetDashboardSummaryUseCase } from "./use-cases/get-dashboard-summary.use-case";
import { GetPilotSummaryUseCase } from "./use-cases/get-pilot-summary.use-case";
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
		ListActivityFeedUseCase,
		ListAnalyticsEventsUseCase,
		ListInactiveEngagementsUseCase,
	],
	exports: [AnalyticsCoreModule],
})
export class AnalyticsModule {}
