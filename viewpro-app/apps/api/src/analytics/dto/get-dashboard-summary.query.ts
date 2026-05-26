import { IsIn, IsOptional } from "class-validator";

export const dashboardSummaryRanges = ["7d", "14d", "30d"] as const;
export type DashboardSummaryRange = (typeof dashboardSummaryRanges)[number];

export class GetDashboardSummaryQuery {
	@IsOptional()
	@IsIn(dashboardSummaryRanges)
	range: DashboardSummaryRange = "7d";
}
