import type { ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "../src/auth/auth.constants";
import { AuthGuard } from "../src/auth/guards/auth.guard";
import { TokenService } from "../src/auth/tokens/token.service";
import { verifyServiceToken } from "../src/platform-control/service-token.verifier";

// RED-CUT-13, product lane. Abandoning the database destroys the refresh, reset and
// verification rows, but a signed access token is verified without touching a database,
// so only rotating the signing secret retires it.
//
// Driven through the REAL TokenService and the REAL guard, so the lever under test is
// the secret the service is registered with rather than one this file hands to its own
// verifier. Against a stub these assertions would only restate how HMAC works, and a
// service that stopped verifying signatures altogether would still pass.
//
// The assertions hold no database, no Nest bootstrap and no network. The suite still
// runs under this workspace's vitest globalSetup, which migrates a worker database
// before any file, so it is not immune to that infrastructure — only its assertions are.

const RETIRED_SECRET = "test-access-token-secret-generation-1";
const CURRENT_SECRET = "test-access-token-secret-generation-2";
const CONTROL_SECRET = "test-platform-control-secret-min16";

// One generation of the product backend: the JwtService the module registers from the
// access secret, the real TokenService over it, and the real guard.
function generation(secret: string) {
	const jwtService = new JwtService({ secret, signOptions: { expiresIn: "15m" } });
	const config = { get: (_key: string, fallback?: unknown) => fallback };
	const tokenService = new TokenService(jwtService, config as never);
	return { tokenService, guard: new AuthGuard(tokenService as never) };
}

function contextWithCookies(cookies: Record<string, string | undefined>) {
	const request = { cookies, user: undefined };
	return {
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;
}

const previous = generation(RETIRED_SECRET);
const current = generation(CURRENT_SECRET);

describe("production cutover — product session invalidation", () => {
	it("retires an access token the previous generation minted", async () => {
		// Minted by one generation's real service, judged by the next generation's real
		// guard: this fails if the service stops reading its registered secret, or if the
		// guard stops verifying the signature at all.
		const retired = await previous.tokenService.signAccessToken({
			sub: "user-1",
			email: "a@b.test",
		});

		await expect(
			current.guard.canActivate(contextWithCookies({ [ACCESS_TOKEN_COOKIE]: retired })),
		).rejects.toMatchObject({
			status: 401,
			// A coded rejection, so a frontend distinguishes an expired session from a
			// wrong-password 401 without matching on the human message.
			response: { errorCode: "SESSION_EXPIRED" },
		});

		// The same token still passes its own generation's guard, so the rejection above
		// is the rotation rather than a malformed fixture.
		await expect(
			previous.guard.canActivate(contextWithCookies({ [ACCESS_TOKEN_COOKIE]: retired })),
		).resolves.toBe(true);

		// And the verifier really was reached and really rejected the signature, rather
		// than the guard's catch swallowing an unrelated fault.
		await expect(current.tokenService.verifyAccessToken(retired)).rejects.toThrow(/signature/i);
	});

	it("admits an access token the current generation minted", async () => {
		const token = await current.tokenService.signAccessToken({ sub: "user-2", email: "c@d.test" });

		await expect(
			current.guard.canActivate(contextWithCookies({ [ACCESS_TOKEN_COOKIE]: token })),
		).resolves.toBe(true);
	});

	it("refuses a request carrying no access cookie", async () => {
		await expect(current.guard.canActivate(contextWithCookies({}))).rejects.toBeInstanceOf(
			UnauthorizedException,
		);
		// A refresh cookie is not a session: it is exchanged, never accepted directly.
		await expect(
			current.guard.canActivate(contextWithCookies({ [REFRESH_TOKEN_COOKIE]: "whatever" })),
		).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it("refuses a tampered or unsigned token", async () => {
		const token = await current.tokenService.signAccessToken({ sub: "user-3", email: "e@f.test" });
		const tampered = `${token.slice(0, -4)}AAAA`;
		// `alg: none` is the classic downgrade: a token nobody signed at all.
		const unsigned = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: "user-3" })).toString("base64url")}.`;

		for (const candidate of [tampered, unsigned, "not-a-token"]) {
			await expect(
				current.guard.canActivate(contextWithCookies({ [ACCESS_TOKEN_COOKIE]: candidate })),
			).rejects.toBeInstanceOf(UnauthorizedException);
		}
	});

	it("leaves the control lane untouched by a session rotation", async () => {
		// The control secret authenticates a backend-to-backend lane, not a human
		// session, so the cutover deliberately does not rotate it. Verified through the
		// REAL control verifier with the issuer, audience and token id it requires — a
		// bare signature check would pass for a token this lane would refuse.
		const controlToken = await new JwtService({ secret: CONTROL_SECRET }).signAsync(
			{ sub: "inmoview", jti: "jti-1" },
			{ issuer: "viewpro-api", audience: "inmoview-control", expiresIn: "15m" },
		);

		await expect(verifyServiceToken(controlToken, CONTROL_SECRET)).resolves.toMatchObject({
			kind: "service",
			callerId: "inmoview",
		});
		// Rotating the session secret does not retire it, and does not admit it either.
		await expect(verifyServiceToken(controlToken, CURRENT_SECRET)).rejects.toThrow('invalid signature');
		await expect(current.tokenService.verifyAccessToken(controlToken)).rejects.toThrow('invalid signature');

		// A session token fails the control lane on its own requirements, not merely its
		// key: it carries no issuer, audience or token id.
		const session = await current.tokenService.signAccessToken({
			sub: "user-4",
			email: "g@h.test",
		});
		await expect(verifyServiceToken(session, CONTROL_SECRET)).rejects.toThrow('invalid signature');
		await expect(verifyServiceToken(session, CURRENT_SECRET)).rejects.toThrow('jwt audience invalid');
	});

	it("stores database-backed tokens as an irreversible digest", async () => {
		// Refresh, reset and verification tokens are stored as a digest and authorised by
		// lookup, so abandoning the database retires them without any rotation. What this
		// asserts is the property that makes an abandoned row unusable: the stored value
		// is not the token, and the same token always digests the same way.
		const raw = "old-generation-refresh-token";
		for (const digest of [
			current.tokenService.hashRefreshToken(raw),
			current.tokenService.hashPasswordResetToken(raw),
			current.tokenService.hashEmailVerificationToken(raw),
		]) {
			expect(digest).toMatch(/^[a-f0-9]{64}$/);
			expect(digest).not.toBe(raw);
		}
		expect(current.tokenService.hashRefreshToken(raw)).toBe(
			current.tokenService.hashRefreshToken(raw),
		);
		expect(current.tokenService.hashRefreshToken(raw)).not.toBe(
			current.tokenService.hashRefreshToken(`${raw}-other`),
		);
	});
});
