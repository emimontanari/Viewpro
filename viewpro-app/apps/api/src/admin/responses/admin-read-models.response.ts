import type {
	AdminActivityRecord,
	AdminTenantRecord,
} from "../admin-read-models.repository";

export type AdminTenantLimitsResponse = {
	maxUsers: number | null;
	maxActivePropertyEngagements: number | null;
	maxDocumentsStorageMb: number | null;
};

export type AdminSummaryResponse = {
	totals: {
		tenants: number;
		activeTenants: number;
		users: number;
		activeEngagements: number;
		documentRequests: number;
		analyticsEvents: number;
	};
	recentActivityCount: number;
	generatedAt: string;
};

export type AdminTenantResponse = {
	id: string;
	name: string;
	slug: string;
	status: string;
	limits: AdminTenantLimitsResponse;
	createdAt: string;
	updatedAt: string;
	counts: {
		memberships: number;
		propertyAssets: number;
		propertyEngagements: number;
		documentRequests: number;
		analyticsEvents: number;
	};
	lastActivityAt: string | null;
};

export type AdminTenantsResponse = {
	total: number;
	page: number;
	pageSize: number;
	items: AdminTenantResponse[];
};

export type AdminActivityResponse = {
	id: string;
	tenantId: string | null;
	eventName: string;
	actorType: string;
	propertyEngagementId: string | null;
	propertyAssetId: string | null;
	documentRequestId: string | null;
	movementId: string | null;
	occurredAt: string;
};

export type AdminActivityListResponse = {
	total: number;
	page: number;
	pageSize: number;
	items: AdminActivityResponse[];
};

export function mapAdminTenantToResponse(input: {
	tenant: AdminTenantRecord;
	propertyAssetCount: number;
	analyticsEventCount: number;
	lastActivityAt: Date | null;
}): AdminTenantResponse {
	return {
		id: input.tenant.id,
		name: input.tenant.name,
		slug: input.tenant.slug,
		status: input.tenant.status,
		limits: {
			maxUsers: input.tenant.maxUsers,
			maxActivePropertyEngagements: input.tenant.maxActivePropertyEngagements,
			maxDocumentsStorageMb: input.tenant.maxDocumentsStorageMb,
		},
		createdAt: input.tenant.createdAt.toISOString(),
		updatedAt: input.tenant.updatedAt.toISOString(),
		counts: {
			memberships: input.tenant._count.memberships,
			propertyAssets: input.propertyAssetCount,
			propertyEngagements: input.tenant._count.propertyEngagements,
			documentRequests: input.tenant._count.documentRequests,
			analyticsEvents: input.analyticsEventCount,
		},
		lastActivityAt: input.lastActivityAt?.toISOString() ?? null,
	};
}

export function mapAdminActivityToResponse(
	activity: AdminActivityRecord,
): AdminActivityResponse {
	return {
		id: activity.id,
		tenantId: activity.tenantId,
		eventName: activity.eventName,
		actorType: activity.actorType,
		propertyEngagementId: activity.propertyEngagementId,
		propertyAssetId: activity.propertyAssetId,
		documentRequestId: activity.documentRequestId,
		movementId: activity.movementId,
		occurredAt: activity.occurredAt.toISOString(),
	};
}
