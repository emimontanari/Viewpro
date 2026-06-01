import { TenantRole } from "@prisma/client";
import { IsIn } from "class-validator";

export const UPDATE_TEAM_MEMBER_ROLES = [
	TenantRole.MANAGER,
	TenantRole.AGENT,
] as const;

export class UpdateTeamMemberRoleDto {
	@IsIn(UPDATE_TEAM_MEMBER_ROLES)
	role!: (typeof UPDATE_TEAM_MEMBER_ROLES)[number];
}
