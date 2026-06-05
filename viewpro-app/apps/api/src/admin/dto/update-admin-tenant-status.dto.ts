import { TenantStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateAdminTenantStatusDto {
	@IsEnum(TenantStatus)
	status!: TenantStatus;
}
