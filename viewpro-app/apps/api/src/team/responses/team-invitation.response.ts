import type {
	TeamInvitationStatus,
	Tenant,
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

export type PendingTeamInvitationResponse = {
	invitationId: string;
	email: string;
	role: TeamInvitationRole;
	status: Extract<TeamInvitationStatus, "PENDING">;
	expiresAt: string;
	createdAt: string;
	invitedByUserId: string;
};

export type PendingTeamInvitationsResponse = {
	items: PendingTeamInvitationResponse[];
};

export type TeamInvitationPublicResponse = {
	email: string;
	role: TeamInvitationRole;
	status: Extract<TeamInvitationStatus, "PENDING">;
	expiresAt: string;
	emailRegistered: boolean;
	tenant: {
		id: string;
		name: string;
		slug: string;
		status: string;
	};
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

export function toPendingTeamInvitationResponse(
	invitation: Pick<
		TeamInvitation,
		| "id"
		| "email"
		| "role"
		| "status"
		| "expiresAt"
		| "createdAt"
		| "invitedByUserId"
	>,
): PendingTeamInvitationResponse {
	return {
		invitationId: invitation.id,
		email: invitation.email,
		role: invitation.role as TeamInvitationRole,
		status: invitation.status as Extract<TeamInvitationStatus, "PENDING">,
		expiresAt: invitation.expiresAt.toISOString(),
		createdAt: invitation.createdAt.toISOString(),
		invitedByUserId: invitation.invitedByUserId,
	};
}

export function toTeamInvitationPublicResponse(
	invitation: Pick<
		TeamInvitation,
		"email" | "role" | "status" | "expiresAt"
	> & { tenant: Pick<Tenant, "id" | "name" | "slug" | "status"> },
	emailRegistered: boolean,
): TeamInvitationPublicResponse {
	return {
		email: invitation.email,
		role: invitation.role as TeamInvitationRole,
		status: invitation.status as Extract<TeamInvitationStatus, "PENDING">,
		expiresAt: invitation.expiresAt.toISOString(),
		emailRegistered,
		tenant: {
			id: invitation.tenant.id,
			name: invitation.tenant.name,
			slug: invitation.tenant.slug,
			status: invitation.tenant.status,
		},
	};
}
