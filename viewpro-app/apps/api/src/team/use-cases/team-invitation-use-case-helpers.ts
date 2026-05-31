import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { TenantRole } from "@prisma/client";
import { PERMISSIONS } from "../../permissions/permissions.constants";
import type { TenantContext } from "../../tenant-context/tenant-context.types";

export function ensureTeamManagePermission(tenant: TenantContext) {
	if (!tenant.permissions.includes(PERMISSIONS.TEAM_MANAGE)) {
		throw new ForbiddenException("Insufficient permissions");
	}
}

export function ensureSupportedInvitationRole(role: TenantRole) {
	if (role !== TenantRole.MANAGER && role !== TenantRole.AGENT) {
		throw new BadRequestException("Unsupported invitation role");
	}
}

export function buildTeamInvitationUrl(publicUrl: string, token: string) {
	return `${publicUrl.replace(/\/$/, "")}/team-invitations/${encodeURIComponent(token)}`;
}
