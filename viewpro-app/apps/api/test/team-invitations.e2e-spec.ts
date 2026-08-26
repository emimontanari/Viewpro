import {
	TeamInvitationStatus,
	TenantMembershipStatus,
	TenantRole,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

type TestAgent = ReturnType<typeof request.agent>;

const managerPassword = `manager-${Date.now()}-fixture`;
const invitedPassword = `invited-${Date.now()}-fixture`;
let sequence = 0;

describe("Team invitation acceptance (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		process.env.NODE_ENV = "test";
		process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret";
		process.env.COOKIE_DOMAIN = "localhost";
		process.env.COOKIE_SECURE = "false";

		app = await createApiApp();
		await app.listen(0);
		prisma = app.get(PrismaService);
	});

	beforeEach(async () => {
		await prisma.teamInvitation.deleteMany();
		await prisma.analyticsEvent.deleteMany();
		await prisma.movement.deleteMany();
		await prisma.propertyAgent.deleteMany();
		await prisma.ownerInvitation.deleteMany();
		await prisma.propertyAssetOwner.deleteMany();
		await prisma.propertyEngagement.deleteMany();
		await prisma.propertyAsset.deleteMany();
		await prisma.refreshToken.deleteMany();
		await prisma.tenantMembership.deleteMany();
		await prisma.tenant.deleteMany();
		await prisma.user.deleteMany();
	});

	afterAll(async () => {
		await app.close();
	});

	it("requires authentication when listing pending team invitations", async () => {
		await request(app.getHttpServer())
			.get("/api/team/invitations")
			.set("x-tenant-id", "tenant-1")
			.expect(401);
	});

	it("requires tenant context when listing pending team invitations", async () => {
		const principal = await registerTenantSession(
			"list-missing-tenant@example.com",
			"List Missing Tenant",
		);

		const response = await principal.agent
			.get("/api/team/invitations")
			.expect(403);

		expect(response.body.message).toBe("Tenant context required");
	});

	it("requires TEAM_MANAGE when listing pending team invitations", async () => {
		const principal = await registerTenantSession(
			"list-principal@example.com",
			"List Principal",
		);
		const manager = await registerTenantSession(
			"list-manager@example.com",
			"List Manager Other",
		);
		await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: manager.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.MANAGER,
			},
		});

		const response = await manager.agent
			.get("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
	});

	it("lists only selected-tenant pending unexpired team invitations", async () => {
		const principal = await registerTenantSession(
			"list-pending-principal@example.com",
			"List Pending Principal",
		);
		const active = await createTeamInvitationForPrincipal(
			principal,
			"active-pending@example.com",
			TenantRole.AGENT,
		);
		const expired = await createTeamInvitationForPrincipal(
			principal,
			"expired-pending@example.com",
			TenantRole.AGENT,
		);
		const revoked = await createTeamInvitationForPrincipal(
			principal,
			"revoked-pending@example.com",
			TenantRole.MANAGER,
		);
		const accepted = await createTeamInvitationForPrincipal(
			principal,
			"accepted-pending@example.com",
			TenantRole.AGENT,
		);
		const otherTenant = await createTeamInvitation(
			"other-tenant-pending@example.com",
			TenantRole.AGENT,
		);

		await prisma.teamInvitation.update({
			where: { id: expired.invitationId },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});
		await prisma.teamInvitation.update({
			where: { id: revoked.invitationId },
			data: { status: TeamInvitationStatus.REVOKED, revokedAt: new Date() },
		});
		await prisma.teamInvitation.update({
			where: { id: accepted.invitationId },
			data: { status: TeamInvitationStatus.ACCEPTED, acceptedAt: new Date() },
		});

		const response = await principal.agent
			.get("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.expect(200);

		expect(response.body).toEqual({
			items: [
				{
					invitationId: active.invitationId,
					email: "active-pending@example.com",
					role: TenantRole.AGENT,
					status: TeamInvitationStatus.PENDING,
					expiresAt: expect.any(String),
					createdAt: expect.any(String),
					invitedByUserId: principal.userId,
				},
			],
		});
		expect(JSON.stringify(response.body)).not.toContain(expired.invitationId);
		expect(JSON.stringify(response.body)).not.toContain(revoked.invitationId);
		expect(JSON.stringify(response.body)).not.toContain(accepted.invitationId);
		expect(JSON.stringify(response.body)).not.toContain(
			otherTenant.invitationId,
		);
		expect(JSON.stringify(response.body)).not.toContain("tokenHash");
		expect(JSON.stringify(response.body)).not.toContain(active.token);
		expect(JSON.stringify(response.body)).not.toContain("invitationUrl");
	});

	it("returns safe public metadata for a pending team invitation token", async () => {
		const { token, principal } = await createTeamInvitation(
			"public-metadata@example.com",
			TenantRole.AGENT,
		);

		const response = await request(app.getHttpServer())
			.get(`/api/team-invitations/${token}`)
			.expect(200);

		expect(response.body).toEqual({
			email: "public-metadata@example.com",
			role: TenantRole.AGENT,
			status: TeamInvitationStatus.PENDING,
			expiresAt: expect.any(String),
			emailRegistered: false,
			tenant: {
				id: principal.tenantId,
				name: expect.any(String),
				slug: expect.any(String),
				status: expect.any(String),
			},
		});
		expect(JSON.stringify(response.body)).not.toContain("tokenHash");
		expect(JSON.stringify(response.body)).not.toContain(token);
	});

	it("returns not found for an unknown team invitation token", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/team-invitations/unknown-token")
			.expect(404);

		expect(response.body.message).toBe("Team invitation not found");
	});

	it("returns gone for expired, revoked, and accepted team invitation tokens", async () => {
		const expired = await createTeamInvitation(
			"expired-team@example.com",
			TenantRole.AGENT,
		);
		await prisma.teamInvitation.update({
			where: { id: expired.invitationId },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});

		const expiredResponse = await request(app.getHttpServer())
			.get(`/api/team-invitations/${expired.token}`)
			.expect(410);
		expect(expiredResponse.body.message).toBe("Team invitation has expired");

		const revoked = await createTeamInvitation(
			"revoked-team@example.com",
			TenantRole.AGENT,
		);
		await prisma.teamInvitation.update({
			where: { id: revoked.invitationId },
			data: { status: TeamInvitationStatus.REVOKED, revokedAt: new Date() },
		});

		const revokedResponse = await request(app.getHttpServer())
			.get(`/api/team-invitations/${revoked.token}`)
			.expect(410);
		expect(revokedResponse.body.message).toBe(
			"Team invitation is no longer available",
		);

		const accepted = await createTeamInvitation(
			"accepted-team@example.com",
			TenantRole.AGENT,
		);
		await prisma.teamInvitation.update({
			where: { id: accepted.invitationId },
			data: { status: TeamInvitationStatus.ACCEPTED, acceptedAt: new Date() },
		});

		const acceptedResponse = await request(app.getHttpServer())
			.get(`/api/team-invitations/${accepted.token}`)
			.expect(410);
		expect(acceptedResponse.body.message).toBe(
			"Team invitation was already accepted",
		);
	});

	it("accepts a team invitation by registering a brand-new user", async () => {
		const { token, principal } = await createTeamInvitation(
			"new-team-member@example.com",
			TenantRole.AGENT,
		);

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "New",
				lastName: "Member",
				password: invitedPassword,
			})
			.expect(201);

		expect(response.body).toMatchObject({
			user: {
				email: "new-team-member@example.com",
				firstName: "New",
				lastName: "Member",
			},
			memberships: [
				expect.objectContaining({
					role: TenantRole.AGENT,
					tenant: expect.objectContaining({ id: principal.tenantId }),
				}),
			],
		});
		expect(stringifySetCookieHeader(response.headers["set-cookie"])).toContain(
			"viewpro_access_token",
		);
		expect(JSON.stringify(response.body)).not.toContain("tokenHash");
		expect(JSON.stringify(response.body)).not.toContain(token);

		await expect(
			prisma.teamInvitation.count({
				where: {
					email: "new-team-member@example.com",
					status: TeamInvitationStatus.ACCEPTED,
					acceptedAt: { not: null },
				},
			}),
		).resolves.toBe(1);
	});

	it("blocks register-mode acceptance when the tenant user limit is zero", async () => {
		const { token, principal, invitationId } = await createTeamInvitation(
			"user-limit-zero@example.com",
			TenantRole.AGENT,
		);
		await prisma.tenant.update({
			where: { id: principal.tenantId },
			data: { maxUsers: 0 },
		});

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Limit",
				password: invitedPassword,
			})
			.expect(409);

		expect(response.body.message).toBe("Tenant user limit exceeded");
		await expect(
			prisma.teamInvitation.findUnique({ where: { id: invitationId } }),
		).resolves.toMatchObject({ status: TeamInvitationStatus.PENDING });
		await expect(
			prisma.user.findUnique({
				where: { email: "user-limit-zero@example.com" },
			}),
		).resolves.toBeNull();
	});

	it("blocks existing-user acceptance when active memberships are at the tenant user limit", async () => {
		const existing = await registerTenantSession(
			"user-limit-existing@example.com",
			"User Limit Existing Other",
		);
		const { token, principal } = await createTeamInvitation(
			"user-limit-existing@example.com",
			TenantRole.MANAGER,
		);
		await prisma.tenant.update({
			where: { id: principal.tenantId },
			data: { maxUsers: 1 },
		});

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({ mode: "login", password: managerPassword })
			.expect(409);

		expect(response.body.message).toBe("Tenant user limit exceeded");
		await expect(
			prisma.tenantMembership.count({
				where: { userId: existing.userId, tenantId: principal.tenantId },
			}),
		).resolves.toBe(0);
	});

	it("does not count deactivated memberships against the tenant user limit", async () => {
		const inactive = await registerTenantSession(
			"user-limit-inactive@example.com",
			"User Limit Inactive Other",
		);
		const { token, principal } = await createTeamInvitation(
			"user-limit-active-seat@example.com",
			TenantRole.AGENT,
		);
		await prisma.tenant.update({
			where: { id: principal.tenantId },
			data: { maxUsers: 2 },
		});
		await prisma.tenantMembership.create({
			data: {
				userId: inactive.userId,
				tenantId: principal.tenantId,
				role: TenantRole.AGENT,
				status: TenantMembershipStatus.DEACTIVATED,
				deactivatedAt: new Date(),
				deactivatedByUserId: principal.userId,
			},
		});

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Active",
				password: invitedPassword,
			})
			.expect(201);

		expect(response.body.user.email).toBe("user-limit-active-seat@example.com");
		await expect(
			prisma.tenantMembership.count({
				where: {
					tenantId: principal.tenantId,
					status: TenantMembershipStatus.ACTIVE,
				},
			}),
		).resolves.toBe(2);
	});

	it("rejects register-mode acceptance for an existing global user", async () => {
		await registerTenantSession(
			"existing-register@example.com",
			"Existing Register Other",
		);
		const { token } = await createTeamInvitation(
			"existing-register@example.com",
			TenantRole.MANAGER,
		);

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Existing",
				password: invitedPassword,
			})
			.expect(409);

		expect(response.body.message).toBe(
			"Team invitation email is already registered",
		);
	});

	it("rejects register-mode acceptance while another email is authenticated", async () => {
		const otherUser = await registerTenantSession(
			"register-wrong-session-other@example.com",
			"Register Wrong Session Other",
		);
		const { token, invitationId } = await createTeamInvitation(
			"register-wrong-session-invited@example.com",
			TenantRole.AGENT,
		);

		const response = await otherUser.agent
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Invited",
				password: invitedPassword,
			})
			.expect(403);

		expect(response.body.message).toBe(
			"Team invitation belongs to another email",
		);
		await expect(
			prisma.user.findUnique({
				where: { email: "register-wrong-session-invited@example.com" },
			}),
		).resolves.toBeNull();
		await expect(
			prisma.teamInvitation.findUnique({ where: { id: invitationId } }),
		).resolves.toMatchObject({ status: TeamInvitationStatus.PENDING });
	});

	it("accepts a team invitation for an existing global user with their password", async () => {
		const existing = await registerTenantSession(
			"existing-password@example.com",
			"Existing Password Other",
		);
		const { token, principal } = await createTeamInvitation(
			"existing-password@example.com",
			TenantRole.MANAGER,
		);

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({ mode: "login", password: managerPassword })
			.expect(201);

		expect(response.body.user.id).toBe(existing.userId);
		expect(JSON.stringify(response.body)).not.toContain("tokenHash");
		expect(JSON.stringify(response.body)).not.toContain(token);
		expect(response.body.memberships).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: TenantRole.MANAGER,
					tenant: expect.objectContaining({ id: principal.tenantId }),
				}),
			]),
		);
		await expect(
			prisma.tenantMembership.count({
				where: { userId: existing.userId, tenantId: principal.tenantId },
			}),
		).resolves.toBe(1);
	});

	it("rejects password acceptance while another email is authenticated", async () => {
		const existing = await registerTenantSession(
			"login-wrong-session-invited@example.com",
			"Login Wrong Session Invited",
		);
		const otherUser = await registerTenantSession(
			"login-wrong-session-other@example.com",
			"Login Wrong Session Other",
		);
		const { token, principal } = await createTeamInvitation(
			"login-wrong-session-invited@example.com",
			TenantRole.AGENT,
		);

		const response = await otherUser.agent
			.post(`/api/team-invitations/${token}/accept`)
			.send({ mode: "login", password: managerPassword })
			.expect(403);

		expect(response.body.message).toBe(
			"Team invitation belongs to another email",
		);
		await expect(
			prisma.tenantMembership.count({
				where: { userId: existing.userId, tenantId: principal.tenantId },
			}),
		).resolves.toBe(0);
	});

	it("rejects existing-user acceptance with an invalid password", async () => {
		await registerTenantSession(
			"wrong-password@example.com",
			"Wrong Password Other",
		);
		const { token } = await createTeamInvitation(
			"wrong-password@example.com",
			TenantRole.AGENT,
		);

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({ mode: "login", password: "incorrect-password" })
			.expect(401);

		expect(response.body.message).toBe("Invalid email or password");
	});

	it("accepts a team invitation with a matching current session", async () => {
		const existing = await registerTenantSession(
			"matching-session@example.com",
			"Matching Session Other",
		);
		const { token, principal } = await createTeamInvitation(
			"matching-session@example.com",
			TenantRole.AGENT,
		);

		const response = await existing.agent
			.post(`/api/team-invitations/${token}/accept`)
			.send({ mode: "current-session" })
			.expect(201);

		expect(response.body.user.id).toBe(existing.userId);
		expect(response.body.memberships).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					role: TenantRole.AGENT,
					tenant: expect.objectContaining({ id: principal.tenantId }),
				}),
			]),
		);
	});

	it("rejects current-session acceptance for another logged-in email", async () => {
		const otherUser = await registerTenantSession(
			"wrong-session@example.com",
			"Wrong Session Other",
		);
		const { token } = await createTeamInvitation(
			"right-session@example.com",
			TenantRole.AGENT,
		);

		const response = await otherUser.agent
			.post(`/api/team-invitations/${token}/accept`)
			.send({ mode: "current-session" })
			.expect(403);

		expect(response.body.message).toBe(
			"Team invitation belongs to another email",
		);
	});

	it("does not accept the same team invitation twice", async () => {
		const { token } = await createTeamInvitation(
			"double-accept@example.com",
			TenantRole.AGENT,
		);

		await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Double",
				password: invitedPassword,
			})
			.expect(201);

		const response = await request(app.getHttpServer())
			.post(`/api/team-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Double",
				password: invitedPassword,
			})
			.expect(410);

		expect(response.body.message).toBe("Team invitation was already accepted");
	});

	async function createTeamInvitation(email: string, role: TenantRole) {
		sequence += 1;
		const principal = await registerTenantSession(
			`principal-${sequence}@example.com`,
			`Team Invite ${sequence}`,
		);
		const invitation = await createTeamInvitationForPrincipal(
			principal,
			email,
			role,
		);

		return { ...invitation, principal };
	}

	async function createTeamInvitationForPrincipal(
		principal: Awaited<ReturnType<typeof registerTenantSession>>,
		email: string,
		role: TenantRole,
	) {
		const response = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email, role })
			.expect(201);

		return {
			invitationId: response.body.invitationId as string,
			invitationUrl: response.body.invitationUrl as string,
			token: extractToken(response.body.invitationUrl as string),
		};
	}

	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({
				whatsappPhone: "3510000000",
				email,
				password: managerPassword,
				firstName: "Owner",
				tenantName,
			})
			.expect(201);

		return {
			agent: agent as TestAgent,
			userId: response.body.user.id as string,
			tenantId: response.body.memberships[0].tenant.id as string,
			membershipId: response.body.memberships[0].id as string,
		};
	}

	function extractToken(invitationUrl: string) {
		const url = new URL(invitationUrl);
		const token = url.pathname.split("/").filter(Boolean).at(-1);
		if (!token) {
			throw new Error(
				`Invitation URL did not include a token: ${invitationUrl}`,
			);
		}
		return decodeURIComponent(token);
	}

	function stringifySetCookieHeader(header: string | string[] | undefined) {
		return Array.isArray(header) ? header.join(";") : (header ?? "");
	}
});
