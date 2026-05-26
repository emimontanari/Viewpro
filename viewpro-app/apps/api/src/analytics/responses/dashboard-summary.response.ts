import type {
	PropertyEngagementStatus,
	PropertyOperationType,
} from "@prisma/client";
import type { ActivityFeedItemResponse } from "./activity-feed.response";
import type { DashboardSummaryRange } from "../dto/get-dashboard-summary.query";

export type DashboardSummaryAgentResponse = {
	id: string;
	userId: string;
	email: string;
	firstName: string | null;
};

export type DashboardSummaryTopPropertyResponse = {
	engagementId: string;
	propertyId: string;
	title: string | null;
	addressLine: string | null;
	city: string | null;
	province: string | null;
	status: PropertyEngagementStatus;
	operationType: PropertyOperationType;
	agents: DashboardSummaryAgentResponse[];
	movementCount: number;
	documentRequestCount: number;
	lastActivityAt: string;
	lastActivityTitle: string;
};

export type DashboardSummaryTopSellerResponse = {
	userId: string;
	name: string;
	email: string;
	movementCount: number;
	touchedPropertiesCount: number;
	lastMovementAt: string;
};

export type DashboardSummaryResponse = {
	range: {
		preset: DashboardSummaryRange;
		from: string;
		to: string;
	};
	counters: {
		activeProperties: number;
		movementsInRange: number;
		staleProperties: number;
		attentionNeeded: number;
	};
	recentActivity: ActivityFeedItemResponse[];
	topProperties: DashboardSummaryTopPropertyResponse[];
	topSellers: DashboardSummaryTopSellerResponse[];
};
