import {
	DocumentRequestStatus,
	DocumentVersionStatus,
	PropertyAssetOwnerAccessStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

describe("Documents internal endpoints (e2e)", () => {
	let app: INestApplication;
	let prisma: PrismaService;

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
		await prisma.documentVersion.deleteMany();
		await prisma.document.deleteMany();
		await prisma.documentRequest.deleteMany();
		await prisma.movement.deleteMany();
		await prisma.propertyAgent.deleteMany();
		await prisma.propertyEngagement.deleteMany();
		await prisma.propertyAssetOwner.deleteMany();
		await prisma.propertyAsset.deleteMany();
		await prisma.refreshToken.deleteMany();
		await prisma.tenantMembership.deleteMany();
		await prisma.tenant.deleteMany();
		await prisma.user.deleteMany();
	});

	afterAll(async () => {
		await app.close();
	});

	it("allows a manager to create a document request for an active owner on a tenant engagement", async () => {
		const manager = await registerTenantSession(
			"documents-manager-create@example.com",
			"Documents Manager Create",
		);
		const owner = await registerOwnerSession(
			"documents-owner-create@example.com",
		);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Documented Manager Property",
		}).expect(201);
		const ownerLink = await grantOwnerAccess(
			owner.userId,
			engagement.body.property.id,
		);

		const response = await manager.agent
			.post(`/api/property-engagements/${engagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({
				propertyAssetOwnerId: ownerLink.id,
				title: "Property deed",
				description: "Latest signed deed.",
			})
			.expect(201);

		expect(response.body).toMatchObject({
			tenantId: manager.tenantId,
			propertyEngagementId: engagement.body.id,
			propertyAssetOwnerId: ownerLink.id,
			ownerUserId: owner.userId,
			requestedByUserId: manager.userId,
			title: "Property deed",
			status: DocumentRequestStatus.PENDING,
			currentVersion: null,
			versions: [],
		});
		await expect(
			prisma.documentRequest.count({
				where: { requestedByUserId: manager.userId },
			}),
		).resolves.toBe(1);
	});

	it("allows a manager to create a document request for an invited owner link", async () => {
		const manager = await registerTenantSession(
			"documents-manager-invited@example.com",
			"Documents Manager Invited",
		);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Invited Owner Document Property",
		}).expect(201);
		const ownerLink = await grantInvitedOwner(engagement.body.property.id, {
			email: "invited-documents-owner@example.com",
			firstName: "Invited",
			lastName: "Owner",
		});

		const response = await manager.agent
			.post(`/api/property-engagements/${engagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({
				propertyAssetOwnerId: ownerLink.id,
				title: "DNI del propietario",
			})
			.expect(201);

		expect(response.body).toMatchObject({
			propertyEngagementId: engagement.body.id,
			propertyAssetOwnerId: ownerLink.id,
			ownerUserId: null,
			title: "DNI del propietario",
			status: DocumentRequestStatus.PENDING,
		});
	});

	it("rejects seller document request creation and scopes seller document lists to assigned properties", async () => {
		const manager = await registerTenantSession(
			"documents-seller-manager@example.com",
			"Documents Seller Tenant",
		);
		const seller = await registerTenantSession(
			"documents-seller@example.com",
			"Documents Seller Temporary",
		);
		const owner = await registerOwnerSession(
			"documents-seller-owner@example.com",
		);
		await addTenantAgent(seller.userId, manager.tenantId);
		const assignedEngagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Assigned Document Property",
		}).expect(201);
		const unassignedEngagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Unassigned Document Property",
		}).expect(201);
		await assignAgent(manager.agent, manager.tenantId, assignedEngagement.body.id, seller.userId).expect(201);
		const assignedOwnerLink = await grantOwnerAccess(owner.userId, assignedEngagement.body.property.id);
		const unassignedOwnerLink = await grantOwnerAccess(owner.userId, unassignedEngagement.body.property.id);

		const forbiddenCreate = await seller.agent
			.post(`/api/property-engagements/${assignedEngagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({ propertyAssetOwnerId: assignedOwnerLink.id, title: "Seller requested deed" })
			.expect(403);
		const assignedRequest = await manager.agent
			.post(`/api/property-engagements/${assignedEngagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({ propertyAssetOwnerId: assignedOwnerLink.id, title: "Assigned deed" })
			.expect(201);
		const unassignedRequest = await manager.agent
			.post(`/api/property-engagements/${unassignedEngagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({ propertyAssetOwnerId: unassignedOwnerLink.id, title: "Unassigned certificate" })
			.expect(201);

		const response = await seller.agent
			.get("/api/document-requests")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(forbiddenCreate.body.message).toBe("Insufficient permissions");
		expect(response.body.total).toBe(1);
		expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
			assignedRequest.body.id,
		]);
		expect(
			response.body.items.map((item: { id: string }) => item.id),
		).not.toContain(unassignedRequest.body.id);
	});

	it("filters internal document requests by property engagement id", async () => {
		const manager = await registerTenantSession(
			"documents-filter-manager@example.com",
			"Documents Filter Tenant",
		);
		const owner = await registerOwnerSession(
			"documents-filter-owner@example.com",
		);
		const firstEngagement = await createEngagement(
			manager.agent,
			manager.tenantId,
			{ title: "First Document Property" },
		).expect(201);
		const secondEngagement = await createEngagement(
			manager.agent,
			manager.tenantId,
			{ title: "Second Document Property" },
		).expect(201);
		const firstOwnerLink = await grantOwnerAccess(owner.userId, firstEngagement.body.property.id);
		const secondOwnerLink = await grantOwnerAccess(owner.userId, secondEngagement.body.property.id);

		const firstRequest = await manager.agent
			.post(
				`/api/property-engagements/${firstEngagement.body.id}/document-requests`,
			)
			.set("x-tenant-id", manager.tenantId)
			.send({ propertyAssetOwnerId: firstOwnerLink.id, title: "First property deed" })
			.expect(201);
		const secondRequest = await manager.agent
			.post(
				`/api/property-engagements/${secondEngagement.body.id}/document-requests`,
			)
			.set("x-tenant-id", manager.tenantId)
			.send({ propertyAssetOwnerId: secondOwnerLink.id, title: "Second property certificate" })
			.expect(201);

		const response = await manager.agent
			.get("/api/document-requests")
			.query({ propertyEngagementId: firstEngagement.body.id })
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.total).toBe(1);
		expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
			firstRequest.body.id,
		]);
		expect(
			response.body.items.map((item: { id: string }) => item.id),
		).not.toContain(secondRequest.body.id);
	});

	it("rejects invalid property engagement id filters", async () => {
		const manager = await registerTenantSession(
			"documents-invalid-filter@example.com",
			"Documents Invalid Filter Tenant",
		);

		await manager.agent
			.get("/api/document-requests")
			.query({ propertyEngagementId: "not-a-uuid" })
			.set("x-tenant-id", manager.tenantId)
			.expect(400);
	});

	it("hides peer-seller and cross-tenant document requests as not found", async () => {
		const tenantA = await registerTenantSession(
			"documents-tenant-a@example.com",
			"Documents Tenant A",
		);
		const peer = await registerTenantSession(
			"documents-tenant-a-peer@example.com",
			"Documents Peer A",
		);
		const tenantB = await registerTenantSession(
			"documents-tenant-b@example.com",
			"Documents Tenant B",
		);
		const owner = await registerOwnerSession(
			"documents-tenant-owner@example.com",
		);
		await addTenantAgent(peer.userId, tenantA.tenantId);
		const engagement = await createEngagement(
			tenantA.agent,
			tenantA.tenantId,
		).expect(201);
		const ownerLink = await grantOwnerAccess(owner.userId, engagement.body.property.id);
		const created = await tenantA.agent
			.post(`/api/property-engagements/${engagement.body.id}/document-requests`)
			.set("x-tenant-id", tenantA.tenantId)
			.send({ propertyAssetOwnerId: ownerLink.id, title: "Hidden deed" })
			.expect(201);

		const peerRead = await peer.agent
			.get(`/api/document-requests/${created.body.id}`)
			.set("x-tenant-id", tenantA.tenantId)
			.expect(404);
		const crossTenantRead = await tenantB.agent
			.get(`/api/document-requests/${created.body.id}`)
			.set("x-tenant-id", tenantB.tenantId)
			.expect(404);

		expect(peerRead.body.message).toBe("Document request not found");
		expect(crossTenantRead.body.message).toBe("Document request not found");
	});

	it("returns 404 when Tenant A approves or rejects Tenant B document request", async () => {
		const tenantA = await registerTenantSession(
			"documents-review-tenant-a@example.com",
			"Documents Review Tenant A",
		);
		const tenantB = await registerTenantSession(
			"documents-review-tenant-b@example.com",
			"Documents Review Tenant B",
		);
		const owner = await registerOwnerSession(
			"documents-review-cross-owner@example.com",
		);
		const engagement = await createEngagement(tenantB.agent, tenantB.tenantId, {
			title: "Tenant B Review Document Property",
		}).expect(201);
		const ownerLink = await grantOwnerAccess(owner.userId, engagement.body.property.id);
		const approveTarget = await seedSubmittedDocumentRequest({
			tenantId: tenantB.tenantId,
			propertyEngagementId: engagement.body.id,
			propertyAssetOwnerId: ownerLink.id,
			ownerUserId: owner.userId,
			requestedByUserId: tenantB.userId,
		});
		const rejectTarget = await seedSubmittedDocumentRequest({
			tenantId: tenantB.tenantId,
			propertyEngagementId: engagement.body.id,
			propertyAssetOwnerId: ownerLink.id,
			ownerUserId: owner.userId,
			requestedByUserId: tenantB.userId,
		});

		const approveResponse = await tenantA.agent
			.post(`/api/document-requests/${approveTarget.id}/approve`)
			.set("x-tenant-id", tenantA.tenantId)
			.expect(404);
		const rejectResponse = await tenantA.agent
			.post(`/api/document-requests/${rejectTarget.id}/reject`)
			.set("x-tenant-id", tenantA.tenantId)
			.send({ reason: "Cross-tenant rejection must be hidden." })
			.expect(404);

		expect(approveResponse.body.message).toBe("Document request not found");
		expect(rejectResponse.body.message).toBe("Document request not found");
		await expect(
			prisma.documentRequest.findUnique({
				where: { id: approveTarget.id },
				select: { status: true },
			}),
		).resolves.toEqual({ status: DocumentRequestStatus.SUBMITTED });
		await expect(
			prisma.documentRequest.findUnique({
				where: { id: rejectTarget.id },
				select: { status: true },
			}),
		).resolves.toEqual({ status: DocumentRequestStatus.SUBMITTED });
	});

	it("requires a rejection reason and lets authorized users create read URLs after upload", async () => {
		const manager = await registerTenantSession(
			"documents-review-manager@example.com",
			"Documents Review Tenant",
		);
		const seller = await registerTenantSession(
			"documents-review-seller@example.com",
			"Documents Review Seller",
		);
		const peer = await registerTenantSession(
			"documents-review-peer@example.com",
			"Documents Review Peer",
		);
		const owner = await registerOwnerSession(
			"documents-review-owner@example.com",
		);
		await addTenantAgent(seller.userId, manager.tenantId);
		await addTenantAgent(peer.userId, manager.tenantId);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Review Property",
		}).expect(201);
		await assignAgent(manager.agent, manager.tenantId, engagement.body.id, seller.userId).expect(201);
		const ownerLink = await grantOwnerAccess(owner.userId, engagement.body.property.id);
		const documentRequest = await seedSubmittedDocumentRequest({
			tenantId: manager.tenantId,
			propertyEngagementId: engagement.body.id,
			propertyAssetOwnerId: ownerLink.id,
			ownerUserId: owner.userId,
			requestedByUserId: seller.userId,
		});
		const version = documentRequest.document?.currentVersion;
		expect(version?.id).toBeTruthy();

		const blankReject = await manager.agent
			.post(`/api/document-requests/${documentRequest.id}/reject`)
			.set("x-tenant-id", manager.tenantId)
			.send({ reason: "   " })
			.expect(400);
		const managerRead = await manager.agent
			.post(`/api/document-versions/${version?.id}/read-url`)
			.set("x-tenant-id", manager.tenantId)
			.expect(201);
		const sellerRead = await seller.agent
			.post(`/api/document-versions/${version?.id}/read-url`)
			.set("x-tenant-id", manager.tenantId)
			.expect(201);
		const peerRead = await peer.agent
			.post(`/api/document-versions/${version?.id}/read-url`)
			.set("x-tenant-id", manager.tenantId)
			.expect(404);

		expect(blankReject.body.message).toBe("Rejection reason is required");
		expect(managerRead.body).toMatchObject({
			version: { id: version?.id },
			readUrl: { storageKey: version?.storageKey, expiresInSeconds: 300 },
		});
		expect(sellerRead.body).toMatchObject({
			version: { id: version?.id },
			readUrl: { storageKey: version?.storageKey },
		});
		expect(peerRead.body.message).toBe("Document version not found");
	});

	it("rejects unauthenticated internal document requests", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/document-requests")
			.expect(401);

		expect(response.body.message).toBe("Authentication required");
	});

	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({
				email,
				password: "password123",
				firstName: "Document",
				tenantName,
			})
			.expect(201);

		return {
			agent,
			userId: response.body.user.id as string,
			tenantId: response.body.memberships[0].tenant.id as string,
		};
	}

	async function registerOwnerSession(email: string) {
		const owner = await registerTenantSession(email, `Temporary ${email}`);
		await prisma.tenantMembership.deleteMany({
			where: { userId: owner.userId },
		});
		return owner;
	}

	function createEngagement(
		agent: request.SuperAgentTest,
		tenantId: string,
		overrides: Partial<Record<string, unknown>> = {},
	) {
		return agent
			.post("/api/property-engagements")
			.set("x-tenant-id", tenantId)
			.send({
				title: "Default Document Property",
				addressLine: "Document Street 123",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.HOUSE,
				operationType: PropertyOperationType.RENT,
				...overrides,
			});
	}

	async function addTenantAgent(userId: string, tenantId: string) {
		return prisma.tenantMembership.create({
			data: { userId, tenantId, role: TenantRole.AGENT },
		});
	}

	function assignAgent(agent: request.SuperAgentTest, tenantId: string, engagementId: string, agentUserId: string) {
		return agent.post(`/api/property-engagements/${engagementId}/agents`).set("x-tenant-id", tenantId).send({ agentUserId });
	}

	async function grantOwnerAccess(userId: string, propertyAssetId: string) {
		const user = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true, firstName: true, lastName: true },
		});

		return prisma.propertyAssetOwner.create({
			data: {
				userId,
				propertyAssetId,
				ownerEmail: user.email.toLowerCase(),
				ownerFirstName: user.firstName,
				ownerLastName: user.lastName ?? "",
				accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
			},
		});
	}

	async function grantInvitedOwner(
		propertyAssetId: string,
		input: { email: string; firstName: string; lastName: string },
	) {
		return prisma.propertyAssetOwner.create({
			data: {
				propertyAssetId,
				ownerEmail: input.email.toLowerCase(),
				ownerFirstName: input.firstName,
				ownerLastName: input.lastName,
				accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
			},
		});
	}

	async function seedSubmittedDocumentRequest(input: {
		tenantId: string;
		propertyEngagementId: string;
		propertyAssetOwnerId: string;
		ownerUserId: string;
		requestedByUserId: string;
	}) {
		const documentRequest = await prisma.documentRequest.create({
			data: {
				...input,
				title: "Uploaded deed",
				status: DocumentRequestStatus.SUBMITTED,
				document: {
					create: {
						versions: {
							create: {
								uploadedByUserId: input.ownerUserId,
								storageKey: "document-requests/uploaded-deed.pdf",
								originalFilename: "uploaded-deed.pdf",
								mimeType: "application/pdf",
								sizeBytes: 1024,
								status: DocumentVersionStatus.UPLOADED,
							},
						},
					},
				},
			},
			include: {
				document: { include: { versions: true, currentVersion: true } },
				propertyEngagement: true,
			},
		});
		const version = documentRequest.document?.versions[0];
		await prisma.document.update({
			where: { id: documentRequest.document?.id },
			data: { currentVersionId: version?.id },
		});
		return prisma.documentRequest.findUniqueOrThrow({
			where: { id: documentRequest.id },
			include: {
				document: { include: { versions: true, currentVersion: true } },
				propertyEngagement: true,
			},
		});
	}
});
