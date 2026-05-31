import { createHash, randomBytes } from "node:crypto";

const TEAM_INVITATION_TOKEN_BYTES = 32;
const TEAM_INVITATION_TTL_DAYS = 14;

export type TeamInvitationToken = {
	token: string;
	tokenHash: string;
	expiresAt: Date;
};

export function createTeamInvitationToken(
	now = new Date(),
): TeamInvitationToken {
	const token = randomBytes(TEAM_INVITATION_TOKEN_BYTES).toString("base64url");

	return {
		token,
		tokenHash: hashTeamInvitationToken(token),
		expiresAt: addDays(now, TEAM_INVITATION_TTL_DAYS),
	};
}

export function hashTeamInvitationToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}
