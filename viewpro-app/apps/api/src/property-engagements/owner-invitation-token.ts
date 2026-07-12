import { createHash, randomBytes } from "node:crypto";

const OWNER_INVITATION_TOKEN_BYTES = 32;
const OWNER_INVITATION_TTL_DAYS = 14;

export type OwnerInvitationToken = {
	token: string;
	tokenHash: string;
	expiresAt: Date;
};

export function createOwnerInvitationToken(
	now = new Date(),
): OwnerInvitationToken {
	const token = randomBytes(OWNER_INVITATION_TOKEN_BYTES).toString("base64url");
	return {
		token,
		tokenHash: hashOwnerInvitationToken(token),
		expiresAt: addDays(now, OWNER_INVITATION_TTL_DAYS),
	};
}

export function hashOwnerInvitationToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function addDays(date: Date, days: number) {
	const result = new Date(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}
