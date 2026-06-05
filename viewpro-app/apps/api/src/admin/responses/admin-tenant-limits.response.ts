import type { AdminTenantLimits } from "../admin-tenant-limits.repository";

export type AdminTenantLimitsUpdateResponse = {
	tenantId: string;
	previousLimits: AdminTenantLimits;
	limits: AdminTenantLimits;
	unchanged: boolean;
	updatedAt: string;
};

export function mapAdminTenantLimitsUpdateResponse(input: {
	tenantId: string;
	previousLimits: AdminTenantLimits;
	limits: AdminTenantLimits;
	unchanged: boolean;
	updatedAt: Date;
}): AdminTenantLimitsUpdateResponse {
	return {
		tenantId: input.tenantId,
		previousLimits: input.previousLimits,
		limits: input.limits,
		unchanged: input.unchanged,
		updatedAt: input.updatedAt.toISOString(),
	};
}
