import type { TeamInvitation, Tenant, TenantRole, User } from "@prisma/client";

export const TEAM_INVITATIONS_REPOSITORY = Symbol(
	"TEAM_INVITATIONS_REPOSITORY",
);

export type TeamInvitationRole = Extract<TenantRole, "MANAGER" | "AGENT">;

export type TeamInvitationWithRawToken = TeamInvitation & { token: string };

export type TeamInvitationWithTenant = TeamInvitation & {
	tenant: Pick<Tenant, "id" | "name" | "slug" | "status">;
};

export type CreateTeamInvitationInput = {
	tenantId: string;
	email: string;
	role: TeamInvitationRole;
	invitedByUserId: string;
	now?: Date;
};

export type CreateTeamInvitationResult =
	| { status: "created"; invitation: TeamInvitationWithRawToken }
	| { status: "alreadyMember" };

export type PendingTeamInvitationRecord = Pick<
	TeamInvitation,
	| "id"
	| "email"
	| "role"
	| "status"
	| "expiresAt"
	| "createdAt"
	| "invitedByUserId"
>;

export type RotateTeamInvitationResult =
	| { status: "created"; invitation: TeamInvitationWithRawToken }
	| { status: "notFound" }
	| { status: "notAvailable" };

export type RevokeTeamInvitationResult =
	| { status: "revoked"; invitation: TeamInvitation }
	| { status: "notFound" }
	| { status: "notAvailable" };

export type ValidateTeamInvitationResult =
	| {
			status: "valid";
			invitation: TeamInvitationWithTenant;
			emailRegistered: boolean;
	  }
	| { status: "notFound" }
	| { status: "expired" }
	| { status: "revoked" }
	| { status: "alreadyAccepted" };

export type AcceptTeamInvitationForNewUserInput = {
	tokenHash: string;
	firstName: string;
	lastName?: string;
	passwordHash: string;
	now?: Date;
};

export type AcceptTeamInvitationForExistingUserInput = {
	tokenHash: string;
	userId: string;
	now?: Date;
};

export type AcceptTeamInvitationResult =
	| { status: "accepted"; user: User }
	| { status: "notFound" }
	| { status: "expired" }
	| { status: "revoked" }
	| { status: "alreadyAccepted" }
	| { status: "alreadyMember" }
	| { status: "userAlreadyExists" }
	| { status: "userNotFound" }
	| { status: "emailMismatch" }
	| { status: "tenantUserLimitExceeded" };

export type TeamInvitationsRepository = {
	createPendingInvitation(
		input: CreateTeamInvitationInput,
	): Promise<CreateTeamInvitationResult>;
	listPendingInvitations(input: {
		tenantId: string;
		now?: Date;
	}): Promise<PendingTeamInvitationRecord[]>;
	resendInvitation(input: {
		tenantId: string;
		invitationId: string;
		invitedByUserId: string;
		now?: Date;
	}): Promise<RotateTeamInvitationResult>;
	revokeInvitation(input: {
		tenantId: string;
		invitationId: string;
		now?: Date;
	}): Promise<RevokeTeamInvitationResult>;
	validateByTokenHash(input: {
		tokenHash: string;
		now?: Date;
	}): Promise<ValidateTeamInvitationResult>;
	acceptForNewUser(
		input: AcceptTeamInvitationForNewUserInput,
	): Promise<AcceptTeamInvitationResult>;
	acceptForExistingUser(
		input: AcceptTeamInvitationForExistingUserInput,
	): Promise<AcceptTeamInvitationResult>;
};
