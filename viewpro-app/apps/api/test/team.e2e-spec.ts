import { TeamInvitationStatus, TenantRole } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

type TestAgent = ReturnType<typeof request.agent>;

describe("Team members (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		process.env.NODE_ENV = "test";
		process.env.ACCESS_TOKEN_SECRET ??= randomUUID();
		process.env.COOKIE_DOMAIN = "localhost";
		process.env.COOKIE_SECURE = "false";

		app = await createApiApp();
		await app.init();
		prisma = app.get(PrismaService);
	});

	beforeEach(async () => {
		await prisma.teamInvitation.deleteMany();
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

	it("lists only members for the selected tenant without sensitive user fields", async () => {
		const manager = await registerTenantSession(
			"team-manager@example.com",
			"Team Manager Homes",
		);
		const second = await registerTenantSession(
			"team-second@example.com",
			"Team Second Homes",
		);
		const otherTenant = await registerTenantSession(
			"team-other@example.com",
			"Other Tenant Homes",
		);

		const secondMembership = await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: second.userId } },
				tenant: { connect: { id: manager.tenantId } },
				role: TenantRole.MANAGER,
			},
		});

		const response = await manager.agent
			.get("/api/team/members")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					membershipId: manager.membershipId,
					userId: manager.userId,
					email: "team-manager@example.com",
					firstName: "Owner",
					lastName: null,
					userStatus: "ACTIVE",
					role: TenantRole.PRINCIPAL_MANAGER,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				}),
				expect.objectContaining({
					membershipId: secondMembership.id,
					userId: second.userId,
					email: "team-second@example.com",
					firstName: "Owner",
					lastName: null,
					userStatus: "ACTIVE",
					role: TenantRole.MANAGER,
					createdAt: expect.any(String),
					updatedAt: expect.any(String),
				}),
			]),
		);

		expect(
			response.body.items.map((item: { userId: string }) => item.userId),
		).not.toContain(otherTenant.userId);
		expect(JSON.stringify(response.body)).not.toContain("passwordHash");
		expect(JSON.stringify(response.body)).not.toContain("globalRole");
	});

	it("rejects requests without tenant context", async () => {
		const manager = await registerTenantSession(
			"team-missing-tenant@example.com",
			"Missing Team Homes",
		);

		const response = await manager.agent.get("/api/team/members").expect(403);

		expect(response.body.message).toBe("Tenant context required");
	});

	it("rejects tenant agents without TEAM_VIEW", async () => {
		const manager = await registerTenantSession(
			"team-owner@example.com",
			"Team Owner Homes",
		);
		const agent = await registerTenantSession(
			"team-agent@example.com",
			"Team Agent Homes",
		);

		await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: agent.userId } },
				tenant: { connect: { id: manager.tenantId } },
				role: TenantRole.AGENT,
			},
		});

		const response = await agent.agent
			.get("/api/team/members")
			.set("x-tenant-id", manager.tenantId)
			.expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
	});

	it("updates an active non-principal member role", async () => {
		const principal = await registerTenantSession(
			"team-role-principal@example.com",
			"Team Role Principal Homes",
		);
		const agent = await registerTenantSession(
			"team-role-agent@example.com",
			"Team Role Agent Homes",
		);
		const membership = await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: agent.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.AGENT,
			},
		});

		const response = await principal.agent
			.patch(`/api/team/members/${membership.id}/role`)
			.set("x-tenant-id", principal.tenantId)
			.send({ role: TenantRole.MANAGER })
			.expect(200);

		expect(response.body).toMatchObject({
			membershipId: membership.id,
			userId: agent.userId,
			role: TenantRole.MANAGER,
			membershipStatus: "ACTIVE",
			deactivatedAt: null,
			deactivatedByUserId: null,
		});
		const updated = await prisma.tenantMembership.findUniqueOrThrow({
			where: { id: membership.id },
		});
		expect(updated.role).toBe(TenantRole.MANAGER);
	});

	it("keeps team member role updates tenant-scoped and principal-protected", async () => {
		const principal = await registerTenantSession(
			"team-role-scope-principal@example.com",
			"Team Role Scope Principal Homes",
		);
		const other = await registerTenantSession(
			"team-role-scope-other@example.com",
			"Team Role Scope Other Homes",
		);
		const member = await registerTenantSession(
			"team-role-scope-member@example.com",
			"Team Role Scope Member Homes",
		);
		const membership = await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: member.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.AGENT,
			},
		});

		await other.agent
			.patch(`/api/team/members/${membership.id}/role`)
			.set("x-tenant-id", other.tenantId)
			.send({ role: TenantRole.MANAGER })
			.expect(404);

		const principalResponse = await principal.agent
			.patch(`/api/team/members/${principal.membershipId}/role`)
			.set("x-tenant-id", principal.tenantId)
			.send({ role: TenantRole.AGENT })
			.expect(400);
		expect(principalResponse.body.message).toBe(
			"Principal manager cannot be changed",
		);

		await principal.agent
			.patch(`/api/team/members/${membership.id}/role`)
			.set("x-tenant-id", principal.tenantId)
			.send({ role: TenantRole.PRINCIPAL_MANAGER })
			.expect(400);
	});

	it("deactivates an active non-principal member and removes tenant access", async () => {
		const principal = await registerTenantSession(
			"team-deactivate-principal@example.com",
			"Team Deactivate Principal Homes",
		);
		const manager = await registerTenantSession(
			"team-deactivate-manager@example.com",
			"Team Deactivate Manager Homes",
		);
		const membership = await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: manager.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.MANAGER,
			},
		});

		const response = await principal.agent
			.post(`/api/team/members/${membership.id}/deactivate`)
			.set("x-tenant-id", principal.tenantId)
			.expect(200);

		expect(response.body).toMatchObject({
			membershipId: membership.id,
			membershipStatus: "DEACTIVATED",
			deactivatedAt: expect.any(String),
			deactivatedByUserId: principal.userId,
		});
		const [deactivated] = await prisma.$queryRaw<
			Array<{
				status: string;
				deactivatedAt: Date | null;
				deactivatedByUserId: string | null;
			}>
		>`SELECT "status", "deactivatedAt", "deactivatedByUserId" FROM "tenant_memberships" WHERE "id" = ${membership.id}`;
		expect(deactivated.status).toBe("DEACTIVATED");
		expect(deactivated.deactivatedAt).toBeInstanceOf(Date);
		expect(deactivated.deactivatedByUserId).toBe(principal.userId);

		const me = await manager.agent.get("/api/auth/me").expect(200);
		expect(
			me.body.memberships.map(
				(item: { tenant: { id: string } }) => item.tenant.id,
			),
		).not.toContain(principal.tenantId);

		const denied = await manager.agent
			.get("/api/team/members")
			.set("x-tenant-id", principal.tenantId)
			.expect(403);
		expect(denied.body.message).toBe("Tenant access denied");

		const listResponse = await principal.agent
			.get("/api/team/members")
			.set("x-tenant-id", principal.tenantId)
			.expect(200);
		expect(listResponse.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					membershipId: membership.id,
					membershipStatus: "DEACTIVATED",
					deactivatedByUserId: principal.userId,
				}),
			]),
		);
	});

	it("protects self and principal manager from deactivation", async () => {
		const principal = await registerTenantSession(
			"team-deactivate-self-principal@example.com",
			"Team Deactivate Self Homes",
		);
		const member = await registerTenantSession(
			"team-deactivate-self-member@example.com",
			"Team Deactivate Self Member Homes",
		);
		await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: member.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.MANAGER,
			},
		});

		const selfResponse = await principal.agent
			.post(`/api/team/members/${principal.membershipId}/deactivate`)
			.set("x-tenant-id", principal.tenantId)
			.expect(400);
		expect(selfResponse.body.message).toBe(
			"You cannot deactivate your own access",
		);
	});

	it("requires authentication when creating team invitations", async () => {
		await request(app.getHttpServer())
			.post("/api/team/invitations")
			.set("x-tenant-id", "tenant-1")
			.send({ email: "seller@example.com", role: TenantRole.AGENT })
			.expect(401);
	});

	it("requires tenant context when creating team invitations", async () => {
		const manager = await registerTenantSession(
			"team-invite-missing-tenant@example.com",
			"Invite Missing Tenant",
		);

		const response = await manager.agent
			.post("/api/team/invitations")
			.send({ email: "seller@example.com", role: TenantRole.AGENT })
			.expect(403);

		expect(response.body.message).toBe("Tenant context required");
	});

	it("rejects managers without TEAM_MANAGE when creating team invitations", async () => {
		const principal = await registerTenantSession(
			"team-invite-principal@example.com",
			"Invite Principal Homes",
		);
		const manager = await registerTenantSession(
			"team-invite-manager@example.com",
			"Invite Manager Homes",
		);

		await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: manager.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.MANAGER,
			},
		});

		const response = await manager.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "seller@example.com", role: TenantRole.AGENT })
			.expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
	});

	it("creates a tenant-scoped team invitation for a principal manager", async () => {
		const principal = await registerTenantSession(
			"team-create-principal@example.com",
			"Team Create Homes",
		);

		const response = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "Seller@Example.com", role: TenantRole.AGENT })
			.expect(201);

		expect(response.body).toEqual({
			invitationId: expect.any(String),
			email: "seller@example.com",
			role: TenantRole.AGENT,
			status: TeamInvitationStatus.PENDING,
			expiresAt: expect.any(String),
			invitationUrl: expect.stringMatching(
				/^http:\/\/localhost:3000\/team-invitations\//,
			),
		});
		expect(JSON.stringify(response.body)).not.toContain("tokenHash");

		const invitation = await prisma.teamInvitation.findUniqueOrThrow({
			where: { id: response.body.invitationId },
		});
		expect(invitation.tenantId).toBe(principal.tenantId);
		expect(invitation.email).toBe("seller@example.com");
		expect(invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(response.body.invitationUrl).not.toContain(invitation.tokenHash);
	});

	it("rejects principal manager team invitation role", async () => {
		const principal = await registerTenantSession(
			"team-create-role@example.com",
			"Team Role Homes",
		);

		const response = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({
				email: "principal-invite@example.com",
				role: TenantRole.PRINCIPAL_MANAGER,
			})
			.expect(400);

		expect(JSON.stringify(response.body)).toContain("role");
	});

	it("rejects invalid team invitation email payloads", async () => {
		const principal = await registerTenantSession(
			"team-create-invalid-email@example.com",
			"Team Invalid Email Homes",
		);

		const response = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "not-an-email", role: TenantRole.AGENT })
			.expect(400);

		expect(response.body.message).toContain("email must be an email");
	});

	it("rejects inviting an existing same-tenant member", async () => {
		const principal = await registerTenantSession(
			"team-existing-principal@example.com",
			"Team Existing Homes",
		);
		const member = await registerTenantSession(
			"team-existing-member@example.com",
			"Team Existing Other",
		);

		await prisma.tenantMembership.create({
			data: {
				user: { connect: { id: member.userId } },
				tenant: { connect: { id: principal.tenantId } },
				role: TenantRole.AGENT,
			},
		});

		const response = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({
				email: "team-existing-member@example.com",
				role: TenantRole.AGENT,
			})
			.expect(409);

		expect(response.body.message).toBe(
			"User is already a member of this tenant",
		);
	});

	it("allows inviting an existing global user without selected-tenant membership", async () => {
		const principal = await registerTenantSession(
			"team-global-principal@example.com",
			"Team Global Homes",
		);
		await registerTenantSession(
			"team-global-user@example.com",
			"Team Global Other",
		);

		const response = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "team-global-user@example.com", role: TenantRole.MANAGER })
			.expect(201);

		expect(response.body.email).toBe("team-global-user@example.com");
		expect(response.body.role).toBe(TenantRole.MANAGER);
	});

	it("revokes older pending invitations for the same tenant and email", async () => {
		const principal = await registerTenantSession(
			"team-duplicate-principal@example.com",
			"Team Duplicate Homes",
		);

		const first = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "duplicate@example.com", role: TenantRole.AGENT })
			.expect(201);
		const second = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "duplicate@example.com", role: TenantRole.AGENT })
			.expect(201);

		const firstInvitation = await prisma.teamInvitation.findUniqueOrThrow({
			where: { id: first.body.invitationId },
		});
		const secondInvitation = await prisma.teamInvitation.findUniqueOrThrow({
			where: { id: second.body.invitationId },
		});
		expect(firstInvitation.status).toBe(TeamInvitationStatus.REVOKED);
		expect(firstInvitation.revokedAt).toBeInstanceOf(Date);
		expect(secondInvitation.status).toBe(TeamInvitationStatus.PENDING);
		expect(first.body.invitationUrl).not.toBe(second.body.invitationUrl);
	});

	it("resends team invitations by rotating the pending token", async () => {
		const principal = await registerTenantSession(
			"team-resend-principal@example.com",
			"Team Resend Homes",
		);
		const created = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "resend@example.com", role: TenantRole.AGENT })
			.expect(201);

		const resent = await principal.agent
			.post(`/api/team/invitations/${created.body.invitationId}/resend`)
			.set("x-tenant-id", principal.tenantId)
			.expect(200);

		expect(resent.body).toMatchObject({
			invitationId: expect.any(String),
			email: "resend@example.com",
			role: TenantRole.AGENT,
			status: TeamInvitationStatus.PENDING,
			invitationUrl: expect.stringMatching(
				/^http:\/\/localhost:3000\/team-invitations\//,
			),
		});
		expect(resent.body.invitationId).not.toBe(created.body.invitationId);
		expect(resent.body.invitationUrl).not.toBe(created.body.invitationUrl);
		const oldInvitation = await prisma.teamInvitation.findUniqueOrThrow({
			where: { id: created.body.invitationId },
		});
		expect(oldInvitation.status).toBe(TeamInvitationStatus.REVOKED);
	});

	it("revokes pending team invitations without returning a raw invitation URL", async () => {
		const principal = await registerTenantSession(
			"team-revoke-principal@example.com",
			"Team Revoke Homes",
		);
		const created = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "revoke@example.com", role: TenantRole.AGENT })
			.expect(201);

		const response = await principal.agent
			.post(`/api/team/invitations/${created.body.invitationId}/revoke`)
			.set("x-tenant-id", principal.tenantId)
			.expect(200);

		expect(response.body).toMatchObject({
			invitationId: created.body.invitationId,
			email: "revoke@example.com",
			role: TenantRole.AGENT,
			status: TeamInvitationStatus.REVOKED,
			revokedAt: expect.any(String),
		});
		expect(response.body).not.toHaveProperty("invitationUrl");
		expect(JSON.stringify(response.body)).not.toContain("tokenHash");
		const invitation = await prisma.teamInvitation.findUniqueOrThrow({
			where: { id: created.body.invitationId },
		});
		expect(invitation.status).toBe(TeamInvitationStatus.REVOKED);
	});

	it("keeps resend and revoke tenant-scoped", async () => {
		const principal = await registerTenantSession(
			"team-scope-principal@example.com",
			"Team Scope Homes",
		);
		const other = await registerTenantSession(
			"team-scope-other@example.com",
			"Team Scope Other",
		);
		const created = await principal.agent
			.post("/api/team/invitations")
			.set("x-tenant-id", principal.tenantId)
			.send({ email: "scope@example.com", role: TenantRole.AGENT })
			.expect(201);

		await other.agent
			.post(`/api/team/invitations/${created.body.invitationId}/resend`)
			.set("x-tenant-id", other.tenantId)
			.expect(404);
		await other.agent
			.post(`/api/team/invitations/${created.body.invitationId}/revoke`)
			.set("x-tenant-id", other.tenantId)
			.expect(404);
	});

	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({
				email,
				password: "password123",
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
});
