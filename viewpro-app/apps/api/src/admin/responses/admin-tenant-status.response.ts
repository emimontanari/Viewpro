import type { TenantStatus } from "@prisma/client";

export type AdminTenantStatusUpdateResponse = {
	tenantId: string;
	previousStatus: TenantStatus;
	status: TenantStatus;
	unchanged: boolean;
	updatedAt: string;
};

export function mapAdminTenantStatusUpdateResponse(input: {
	tenantId: string;
	previousStatus: TenantStatus;
	status: TenantStatus;
	unchanged: boolean;
	updatedAt: Date;
}): AdminTenantStatusUpdateResponse {
	return {
		tenantId: input.tenantId,
		previousStatus: input.previousStatus,
		status: input.status,
		unchanged: input.unchanged,
		updatedAt: input.updatedAt.toISOString(),
	};
}
