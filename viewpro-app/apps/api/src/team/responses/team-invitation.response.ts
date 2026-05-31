import type {
	TeamInvitationStatus,
	TenantRole,
	TeamInvitation,
} from "@prisma/client";

export type TeamInvitationRole = Extract<TenantRole, "MANAGER" | "AGENT">;

export type TeamInvitationLinkResponse = {
	invitationId: string;
	email: string;
	role: TeamInvitationRole;
	status: Extract<TeamInvitationStatus, "PENDING">;
	expiresAt: string;
	invitationUrl: string;
};

export type TeamInvitationResponse = {
	invitationId: string;
	email: string;
	role: TeamInvitationRole;
	status: TeamInvitationStatus;
	expiresAt: string;
	revokedAt: string | null;
};

export function toTeamInvitationLinkResponse(
	invitation: Pick<
		TeamInvitation,
		"id" | "email" | "role" | "status" | "expiresAt"
	>,
	invitationUrl: string,
): TeamInvitationLinkResponse {
	return {
		invitationId: invitation.id,
		email: invitation.email,
		role: invitation.role as TeamInvitationRole,
		status: invitation.status as Extract<TeamInvitationStatus, "PENDING">,
		expiresAt: invitation.expiresAt.toISOString(),
		invitationUrl,
	};
}

export function toTeamInvitationResponse(
	invitation: Pick<
		TeamInvitation,
		"id" | "email" | "role" | "status" | "expiresAt" | "revokedAt"
	>,
): TeamInvitationResponse {
	return {
		invitationId: invitation.id,
		email: invitation.email,
		role: invitation.role as TeamInvitationRole,
		status: invitation.status,
		expiresAt: invitation.expiresAt.toISOString(),
		revokedAt: invitation.revokedAt?.toISOString() ?? null,
	};
}
