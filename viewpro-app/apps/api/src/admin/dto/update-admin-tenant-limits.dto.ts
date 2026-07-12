import { IsInt, IsOptional, Min } from "class-validator";

export class UpdateAdminTenantLimitsDto {
	@IsOptional()
	@IsInt()
	@Min(0)
	maxUsers?: number | null;

	@IsOptional()
	@IsInt()
	@Min(0)
	maxActivePropertyEngagements?: number | null;

	@IsOptional()
	@IsInt()
	@Min(0)
	maxDocumentsStorageMb?: number | null;
}
