import { TenantRole } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEmail, IsIn } from "class-validator";

export type TeamInvitationRole = Extract<TenantRole, "MANAGER" | "AGENT">;

export class CreateTeamInvitationDto {
	@Transform(({ value }) =>
		typeof value === "string" ? value.trim().toLowerCase() : value,
	)
	@IsEmail()
	email!: string;

	@IsIn([TenantRole.MANAGER, TenantRole.AGENT])
	role!: TeamInvitationRole;
}
