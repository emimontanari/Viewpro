import {
	OwnerInvitationStatus,
	PropertyAssetOwnerAccessStatus,
	PropertyOperationType,
	PropertyType,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { argon2id, hash as hashPassword } from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ACCESS_TOKEN_COOKIE } from "../src/auth/auth.constants";
import { TokenService } from "../src/auth/tokens/token.service";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";
import { hashOwnerInvitationToken } from "../src/property-engagements/owner-invitation-token";

type TestAgent = ReturnType<typeof request.agent>;

const rawToken = "stage-21-valid-owner-token";
const managerPassword = `manager-${Date.now()}-fixture`;
const ownerPassword = `owner-${Date.now()}-fixture`;
let tokenSequence = 0;

describe("Owner invitations (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let tokenService: TokenService;
	let invitationSequence = 0;

	beforeAll(async () => {
		process.env.NODE_ENV = "test";
		process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret";
		process.env.COOKIE_DOMAIN = "localhost";
		process.env.COOKIE_SECURE = "false";

		app = await createApiApp();
		await app.listen(0);
		prisma = app.get(PrismaService);
		tokenService = app.get(TokenService);
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
		const { invitation, ownerLink, engagement, manager } =
			await createPendingInvitation(rawToken);

		const response = await request(app.getHttpServer())
			.get(`/api/owner-invitations/${rawToken}`)
			.expect(200);

		expect(response.body).toEqual({
			id: invitation.id,
			email: "invited-owner@example.com",
			emailRegistered: false,
			ownerFirstName: "Invited",
			ownerLastName: "Owner",
			propertyAssetOwnerId: ownerLink.id,
			// #303 criterion 1: the owner can tell which agency invited them. Read
			// from the engagement the invitation records, not chosen from a list.
			agencyName: manager.tenantName,
			property: {
				id: engagement.body.property.id,
				title: "Invitation property",
				city: "Buenos Aires",
				province: "CABA",
			},
			expiresAt: invitation.expiresAt.toISOString(),
		});
		// #303 criterion 2: the street address is not part of the default payload.
		// City and province stay — they let the owner recognise which property this
		// is without handing the exact location to whoever holds the link.
		expect(response.body.property).not.toHaveProperty("addressLine");
		expect(JSON.stringify(response.body)).not.toContain("Av. Invitacion 123");

		expect(response.body).not.toHaveProperty("tokenHash");
		expect(JSON.stringify(response.body)).not.toContain(
			hashOwnerInvitationToken(rawToken),
		);
	});

	it("marks invitation metadata when the owner email is already registered", async () => {
		const token = makeRawToken();
		await createPendingInvitation(token);
		await registerOwnerAccount("invited-owner@example.com");

		const response = await request(app.getHttpServer())
			.get(`/api/owner-invitations/${token}`)
			.expect(200);

		expect(response.body).toMatchObject({
			email: "invited-owner@example.com",
			emailRegistered: true,
		});
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

	it("accepts a pending invitation by creating an owner-only user and activating the link", async () => {
		const token = makeRawToken();
		const { ownerLink } = await createPendingInvitation(token);

		const response = await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({
				firstName: "Accepted",
				lastName: "Owner",
				password: ownerPassword,
			})
			.expect(201);

		expect(response.body).toMatchObject({
			user: {
				email: "invited-owner@example.com",
				firstName: "Accepted",
				lastName: "Owner",
			},
			memberships: [],
		});
		const setCookieHeader = stringifySetCookieHeader(
			response.headers["set-cookie"],
		);
		expect(setCookieHeader).toContain("viewpro_access_token");
		expect(setCookieHeader).toContain("viewpro_refresh_token");

		const user = await prisma.user.findUniqueOrThrow({
			where: { email: "invited-owner@example.com" },
		});
		await expect(
			prisma.tenantMembership.count({ where: { userId: user.id } }),
		).resolves.toBe(0);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: user.id,
					accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
				},
			}),
		).resolves.toBe(1);
		await expect(
			prisma.ownerInvitation.count({
				where: {
					propertyAssetOwnerId: ownerLink.id,
					status: OwnerInvitationStatus.ACCEPTED,
					acceptedAt: { not: null },
				},
			}),
		).resolves.toBe(1);
	});

	it("lets the accepted owner access owner portal properties", async () => {
		const token = makeRawToken();
		const { engagement } = await createPendingInvitation(token);
		const ownerAgent = request.agent(app.getHttpServer());

		await ownerAgent
			.post(`/api/owner-invitations/${token}/accept`)
			.send({
				firstName: "Accepted",
				lastName: "Owner",
				password: ownerPassword,
			})
			.expect(201);

		const properties = await ownerAgent
			.get("/api/owner/properties")
			.expect(200);
		expect(properties.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: engagement.body.property.id,
					title: "Invitation property",
				}),
			]),
		);
	});

	it("rejects accepting the same invitation twice", async () => {
		const token = makeRawToken();
		await createPendingInvitation(token);

		await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({
				firstName: "Accepted",
				lastName: "Owner",
				password: ownerPassword,
			})
			.expect(201);

		const response = await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({
				firstName: "Accepted",
				lastName: "Owner",
				password: ownerPassword,
			})
			.expect(410);

		expect(response.body.message).toBe("Owner invitation was already accepted");
	});

	it("lets an existing owner accept an invitation with their password", async () => {
		const token = makeRawToken();
		const { invitation, ownerLink, engagement } =
			await createPendingInvitation(token);
		const owner = await registerOwnerAccount("invited-owner@example.com");

		const response = await owner.agent
			.post(`/api/owner-invitations/${token}/accept`)
			.send({ mode: "login", password: managerPassword })
			.expect(201);

		expect(response.body).toMatchObject({
			user: {
				id: owner.userId,
				email: "invited-owner@example.com",
			},
		});
		await expect(
			prisma.user.count({ where: { email: "invited-owner@example.com" } }),
		).resolves.toBe(1);
		await expect(
			prisma.ownerInvitation.count({
				where: {
					id: invitation.id,
					status: OwnerInvitationStatus.ACCEPTED,
					acceptedAt: { not: null },
				},
			}),
		).resolves.toBe(1);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: owner.userId,
					accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
				},
			}),
		).resolves.toBe(1);

		const properties = await owner.agent
			.get("/api/owner/properties")
			.expect(200);
		expect(properties.body).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: engagement.body.property.id,
					title: "Invitation property",
				}),
			]),
		);
	});

	it("lets a signed-in existing owner accept an invitation for the same email", async () => {
		const token = makeRawToken();
		const { ownerLink } = await createPendingInvitation(token);
		const owner = await registerOwnerAccount("invited-owner@example.com");

		await owner.agent
			.post(`/api/owner-invitations/${token}/accept`)
			.set("Cookie", owner.accessCookie)
			.send({ mode: "current-session" })
			.expect(201);

		await expect(
			prisma.user.count({ where: { email: "invited-owner@example.com" } }),
		).resolves.toBe(1);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: owner.userId,
					accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
				},
			}),
		).resolves.toBe(1);
	});

	it("rejects an existing owner login with the wrong password without activating the invitation", async () => {
		const token = makeRawToken();
		const { invitation, ownerLink } = await createPendingInvitation(token);
		await registerOwnerAccount("invited-owner@example.com");

		const response = await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({ mode: "login", password: "wrong-password-123" })
			.expect(401);

		expect(response.body.message).toBe("Invalid email or password");
		await expect(
			prisma.ownerInvitation.count({
				where: { id: invitation.id, status: OwnerInvitationStatus.PENDING },
			}),
		).resolves.toBe(1);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: null,
					accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
				},
			}),
		).resolves.toBe(1);
	});

	it("rejects current-session acceptance from a different email without activating the invitation", async () => {
		const token = makeRawToken();
		const { invitation, ownerLink } = await createPendingInvitation(token);
		const wrongOwner = await registerOwnerAccount("wrong-owner@example.com");

		const response = await wrongOwner.agent
			.post(`/api/owner-invitations/${token}/accept`)
			.set("Cookie", wrongOwner.accessCookie)
			.send({ mode: "current-session" })
			.expect(403);

		expect(response.body.message).toBe(
			"Owner invitation belongs to another email",
		);
		await expect(
			prisma.ownerInvitation.count({
				where: { id: invitation.id, status: OwnerInvitationStatus.PENDING },
			}),
		).resolves.toBe(1);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: null,
					accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
				},
			}),
		).resolves.toBe(1);
	});

	it("still rejects register-mode acceptance when the owner email is already registered", async () => {
		const token = makeRawToken();
		const { invitation, ownerLink } = await createPendingInvitation(token);
		await registerOwnerAccount("invited-owner@example.com");

		const response = await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({
				mode: "register",
				firstName: "Accepted",
				lastName: "Owner",
				password: ownerPassword,
			})
			.expect(409);

		expect(response.body.message).toBe("Owner email is already registered");
		await expect(
			prisma.ownerInvitation.count({
				where: { id: invitation.id, status: OwnerInvitationStatus.PENDING },
			}),
		).resolves.toBe(1);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: null,
					accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
				},
			}),
		).resolves.toBe(1);
	});

	it("rejects accepting an expired invitation", async () => {
		const token = makeRawToken();
		const { invitation } = await createPendingInvitation(token);
		await prisma.ownerInvitation.update({
			where: { id: invitation.id },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});

		const response = await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({ firstName: "Accepted", password: ownerPassword })
			.expect(410);

		expect(response.body.message).toBe("Owner invitation has expired");
	});

	it("rejects weak owner invitation credentials", async () => {
		const token = makeRawToken();
		const { invitation, ownerLink } = await createPendingInvitation(token);

		await request(app.getHttpServer())
			.post(`/api/owner-invitations/${token}/accept`)
			.send({ firstName: "Accepted", password: ownerPassword.slice(0, 5) })
			.expect(400);

		await expect(
			prisma.ownerInvitation.count({
				where: { id: invitation.id, status: OwnerInvitationStatus.PENDING },
			}),
		).resolves.toBe(1);
		await expect(
			prisma.propertyAssetOwner.count({
				where: {
					id: ownerLink.id,
					userId: null,
					accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
				},
			}),
		).resolves.toBe(1);
	});

	function makeRawToken() {
		tokenSequence += 1;
		return `stage-21-owner-token-${tokenSequence}`;
	}

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
				whatsappPhone: "3510000000",
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
			tenantName: response.body.memberships[0].tenant.name as string,
		};
	}

	async function registerOwnerAccount(email: string) {
		const user = await prisma.user.create({
			data: {
				email: email.toLowerCase(),
				firstName: "Existing",
				lastName: "Owner",
				passwordHash: await hashPassword(managerPassword, { type: argon2id }),
			},
		});
		const accessToken = await tokenService.signAccessToken({
			sub: user.id,
			email: user.email,
		});

		return {
			agent: request.agent(app.getHttpServer()),
			accessCookie: `${ACCESS_TOKEN_COOKIE}=${accessToken}`,
			userId: user.id,
		};
	}

	function stringifySetCookieHeader(header: string | string[] | undefined) {
		return Array.isArray(header) ? header.join(";") : (header ?? "");
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
