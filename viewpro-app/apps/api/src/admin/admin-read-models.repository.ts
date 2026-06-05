import type {
	AnalyticsActorType,
	AnalyticsEventName,
	Prisma,
	TenantStatus,
} from "@prisma/client";

export const ADMIN_READ_MODELS_REPOSITORY = Symbol(
	"ADMIN_READ_MODELS_REPOSITORY",
);

export type AdminTenantRecord = Prisma.TenantGetPayload<{
	select: {
		id: true;
		name: true;
		slug: true;
		status: true;
		maxUsers: true;
		maxActivePropertyEngagements: true;
		maxDocumentsStorageMb: true;
		createdAt: true;
		updatedAt: true;
		_count: {
			select: {
				memberships: true;
				propertyEngagements: true;
				documentRequests: true;
			};
		};
	};
}>;

export type AdminActivityRecord = {
	id: string;
	tenantId: string | null;
	actorType: AnalyticsActorType;
	eventName: AnalyticsEventName;
	propertyEngagementId: string | null;
	propertyAssetId: string | null;
	documentRequestId: string | null;
	movementId: string | null;
	occurredAt: Date;
};

export type AdminSummaryRecord = {
	totals: {
		tenants: number;
		activeTenants: number;
		users: number;
		activeEngagements: number;
		documentRequests: number;
		analyticsEvents: number;
	};
	recentActivityCount: number;
};

export type ListAdminTenantsInput = {
	page: number;
	pageSize: number;
	status?: TenantStatus;
};

export type ListAdminTenantsResult = {
	total: number;
	items: AdminTenantRecord[];
	propertyAssetCounts: Map<string, number>;
	analyticsEventCounts: Map<string, number>;
	lastActivityAtByTenant: Map<string, Date>;
};

export type ListAdminActivityInput = {
	page: number;
	pageSize: number;
	tenantId?: string;
};

export type ListAdminActivityResult = {
	total: number;
	items: AdminActivityRecord[];
};

export type AdminReadModelsRepository = {
	getSummary(input: { recentActivityFrom: Date }): Promise<AdminSummaryRecord>;
	listTenants(input: ListAdminTenantsInput): Promise<ListAdminTenantsResult>;
	listActivity(input: ListAdminActivityInput): Promise<ListAdminActivityResult>;
};
