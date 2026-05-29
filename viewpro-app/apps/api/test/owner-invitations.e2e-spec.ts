import {
	OwnerInvitationStatus,
	PropertyOperationType,
	PropertyType,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";
import { hashOwnerInvitationToken } from "../src/property-engagements/owner-invitation-token";

type TestAgent = ReturnType<typeof request.agent>;

const rawToken = "stage-21-valid-owner-token";
const managerPassword = `manager-${Date.now()}-fixture`;

describe("Owner invitations (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let invitationSequence = 0;

	beforeAll(async () => {
		process.env.NODE_ENV = "test";
		process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret";
		process.env.COOKIE_DOMAIN = "localhost";
		process.env.COOKIE_SECURE = "false";

		app = await createApiApp();
		await app.init();
		prisma = app.get(PrismaService);
	});

	beforeEach(async () => {
		await prisma.analyticsEvent.deleteMany();
		await prisma.ownerInvitation.deleteMany();
		await prisma.documentVersion.deleteMany();
		await prisma.document.deleteMany();
		await prisma.documentRequest.deleteMany();
		await prisma.movement.deleteMany();
		await prisma.propertyAgent.deleteMany();
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

	it("returns safe metadata for a pending owner invitation token", async () => {
		const { invitation, ownerLink, engagement } =
			await createPendingInvitation(rawToken);

		const response = await request(app.getHttpServer())
			.get(`/api/owner-invitations/${rawToken}`)
			.expect(200);

		expect(response.body).toEqual({
			id: invitation.id,
			email: "invited-owner@example.com",
			ownerFirstName: "Invited",
			ownerLastName: "Owner",
			propertyAssetOwnerId: ownerLink.id,
			property: {
				id: engagement.body.property.id,
				title: "Invitation property",
				addressLine: "Av. Invitacion 123",
				city: "Buenos Aires",
				province: "CABA",
			},
			expiresAt: invitation.expiresAt.toISOString(),
		});
		expect(response.body).not.toHaveProperty("tokenHash");
		expect(JSON.stringify(response.body)).not.toContain(
			hashOwnerInvitationToken(rawToken),
		);
	});

	it("returns not found for an unknown invitation token", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/owner-invitations/unknown-token")
			.expect(404);

		expect(response.body.message).toBe("Owner invitation not found");
	});

	it("returns gone for an expired invitation token", async () => {
		const { invitation } = await createPendingInvitation(rawToken);
		await prisma.ownerInvitation.update({
			where: { id: invitation.id },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});

		const response = await request(app.getHttpServer())
			.get(`/api/owner-invitations/${rawToken}`)
			.expect(410);

		expect(response.body.message).toBe("Owner invitation has expired");
	});

	it("returns gone for a revoked invitation token", async () => {
		const { invitation } = await createPendingInvitation(rawToken);
		await prisma.ownerInvitation.update({
			where: { id: invitation.id },
			data: {
				status: OwnerInvitationStatus.REVOKED,
				revokedAt: new Date(),
			},
		});

		const response = await request(app.getHttpServer())
			.get(`/api/owner-invitations/${rawToken}`)
			.expect(410);

		expect(response.body.message).toBe(
			"Owner invitation is no longer available",
		);
	});

	it("returns gone for an accepted invitation token", async () => {
		const { invitation } = await createPendingInvitation(rawToken);
		await prisma.ownerInvitation.update({
			where: { id: invitation.id },
			data: {
				status: OwnerInvitationStatus.ACCEPTED,
				acceptedAt: new Date(),
			},
		});

		const response = await request(app.getHttpServer())
			.get(`/api/owner-invitations/${rawToken}`)
			.expect(410);

		expect(response.body.message).toBe("Owner invitation was already accepted");
	});

	async function createPendingInvitation(token: string) {
		invitationSequence += 1;
		const manager = await registerTenantSession(
			`manager-owner-invite-${invitationSequence}@example.com`,
			`Owner Invite Homes ${invitationSequence}`,
		);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Invitation property",
			addressLine: "Av. Invitacion 123",
		}).expect(201);

		const ownerResponse = await manager.agent
			.post(`/api/property-engagements/${engagement.body.id}/owners`)
			.set("x-tenant-id", manager.tenantId)
			.send({
				firstName: "Invited",
				lastName: "Owner",
				email: "invited-owner@example.com",
			})
			.expect(201);

		const existingInvitation = await prisma.ownerInvitation.findFirstOrThrow({
			where: { propertyAssetOwnerId: ownerResponse.body.id },
		});
		const invitation = await prisma.ownerInvitation.update({
			where: { id: existingInvitation.id },
			data: {
				tokenHash: hashOwnerInvitationToken(token),
				expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
				status: OwnerInvitationStatus.PENDING,
				acceptedAt: null,
				revokedAt: null,
			},
		});

		return { invitation, ownerLink: ownerResponse.body, engagement, manager };
	}

	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({
				email,
				password: managerPassword,
				firstName: "Manager",
				tenantName,
			})
			.expect(201);

		return {
			agent,
			userId: response.body.user.id as string,
			tenantId: response.body.memberships[0].tenant.id as string,
		};
	}

	function createEngagement(
		agent: TestAgent,
		tenantId: string,
		overrides: Partial<Record<string, unknown>> = {},
	) {
		return agent
			.post("/api/property-engagements")
			.set("x-tenant-id", tenantId)
			.send({
				title: "Default Property",
				addressLine: "Default Street 123",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.HOUSE,
				operationType: PropertyOperationType.RENT,
				...overrides,
			});
	}
});
