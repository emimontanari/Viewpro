import { describe, expect, it } from "vitest";
import {
	createTeamInvitationToken,
	hashTeamInvitationToken,
} from "../src/team/team-invitation-token";

describe("team invitation token", () => {
	it("creates a secure raw token, hash, and 14-day expiration", () => {
		const now = new Date("2026-05-31T10:00:00.000Z");
		const invitation = createTeamInvitationToken(now);

		expect(invitation.token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(invitation.token.length).toBeGreaterThanOrEqual(40);
		expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(invitation.tokenHash).not.toBe(invitation.token);
		expect(invitation.expiresAt.toISOString()).toBe("2026-06-14T10:00:00.000Z");
	});

	it("hashes tokens deterministically", () => {
		expect(hashTeamInvitationToken("token-value")).toBe(
			hashTeamInvitationToken("token-value"),
		);
		expect(hashTeamInvitationToken("token-value")).not.toBe(
			hashTeamInvitationToken("other-token"),
		);
	});
});
