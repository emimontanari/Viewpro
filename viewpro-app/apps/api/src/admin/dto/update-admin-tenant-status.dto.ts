import { IsIn } from "class-validator";

/**
 * DTO for PATCH /admin/tenants/:id/status (legacy InmoView console lane).
 *
 * ACTIVE and SUSPENDED are the only writable targets on this deprecated lane.
 * Irreversible CANCELLED (and initial-only TRIAL) are rejected here with a 400
 * validation error: cancellation is an operator-control-lane capability only
 * (POST /internal/platform/tenants/:id/status via that lane's SetTenantStatusDto),
 * which still forwards CANCELLED to the shared AdminTenantStatusService.
 */
export class UpdateAdminTenantStatusDto {
	@IsIn(["ACTIVE", "SUSPENDED"])
	status!: "ACTIVE" | "SUSPENDED";
}
