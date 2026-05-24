import {
	AnalyticsActorType,
	AnalyticsEventName,
	MovementType,
	PropertyAssetOwnerAccessStatus,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

type TestAgent = ReturnType<typeof request.agent>;

describe("Analytics reports (e2e)", () => {
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
		await prisma.analyticsEvent.deleteMany();
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

	it("lets a manager read pilot summary for their tenant only", async () => {
		const manager = await registerTenantSession(
			"analytics-manager-summary@example.com",
			"Analytics Summary Homes",
		);
		const otherTenant = await registerTenantSession(
			"analytics-other-summary@example.com",
			"Other Summary Homes",
		);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Updated Tenant Property",
		}).expect(201);
		const otherEngagement = await createEngagement(
			otherTenant.agent,
			otherTenant.tenantId,
			{ title: "Other Tenant Property" },
		).expect(201);
		await prisma.propertyEngagement.updateMany({
			data: { status: PropertyEngagementStatus.ACTIVE_PUBLICATION },
		});
		await seedMovementEvent(
			manager.tenantId,
			manager.userId,
			engagement.body.id,
			new Date(),
		);
		await seedMovementEvent(
			otherTenant.tenantId,
			otherTenant.userId,
			otherEngagement.body.id,
			new Date(),
		);

		const response = await manager.agent
			.get("/api/analytics/pilot-summary")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.activeEngagements).toBe(1);
		expect(response.body.activeEngagementsWithOwnerVisibleUpdate).toBe(1);
		expect(response.body.activeEngagementUpdatePercentage).toBe(100);
	});

	it("lists inactive active engagements without returning recently updated engagements", async () => {
		const manager = await registerTenantSession(
			"analytics-manager-inactive@example.com",
			"Analytics Inactive Homes",
		);
		const otherTenant = await registerTenantSession(
			"analytics-other-inactive@example.com",
			"Analytics Other Inactive Homes",
		);
		const updated = await createEngagement(manager.agent, manager.tenantId, {
			title: "Recently Updated Property",
		}).expect(201);
		const inactive = await createEngagement(manager.agent, manager.tenantId, {
			title: "Inactive Property",
		}).expect(201);
		const otherInactive = await createEngagement(
			otherTenant.agent,
			otherTenant.tenantId,
			{ title: "Other Tenant Inactive Property" },
		).expect(201);
		await prisma.propertyEngagement.updateMany({
			data: { status: PropertyEngagementStatus.ACTIVE_PUBLICATION },
		});
		await seedMovementEvent(
			manager.tenantId,
			manager.userId,
			updated.body.id,
			new Date(),
		);

		const response = await manager.agent
			.get("/api/analytics/inactive-engagements")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toMatchObject({
			id: inactive.body.id,
			tenantId: manager.tenantId,
		});
		expect(
			response.body.items.map((item: { id: string }) => item.id),
		).not.toContain(updated.body.id);
		expect(
			response.body.items.map((item: { id: string }) => item.id),
		).not.toContain(otherInactive.body.id);
	});

	it("lists tenant-scoped analytics events with pagination", async () => {
		const tenantA = await registerTenantSession(
			"analytics-events-a@example.com",
			"Analytics Events A",
		);
		const tenantB = await registerTenantSession(
			"analytics-events-b@example.com",
			"Analytics Events B",
		);
		await seedTenantEvent(
			tenantA.tenantId,
			tenantA.userId,
			AnalyticsEventName.DOCUMENT_REQUESTED,
			new Date("2026-05-16T10:00:00.000Z"),
		);
		await seedTenantEvent(
			tenantA.tenantId,
			tenantA.userId,
			AnalyticsEventName.MOVEMENT_CREATED,
			new Date("2026-05-16T11:00:00.000Z"),
			{
				source: "test",
				email: "owner@example.com",
				nested: { token: "secret-token", safeFlag: true },
			},
		);
		await seedTenantEvent(
			tenantB.tenantId,
			tenantB.userId,
			AnalyticsEventName.MOVEMENT_CREATED,
			new Date("2026-05-16T12:00:00.000Z"),
		);

		const response = await tenantA.agent
			.get("/api/analytics/events?page=1&pageSize=1")
			.set("x-tenant-id", tenantA.tenantId)
			.expect(200);

		expect(response.body.total).toBe(2);
		expect(response.body.page).toBe(1);
		expect(response.body.pageSize).toBe(1);
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0].tenantId).toBe(tenantA.tenantId);
		expect(response.body.items[0].tenantId).not.toBe(tenantB.tenantId);
		expect(response.body.items[0].metadata).toEqual({
			source: "test",
			nested: { safeFlag: true },
		});
	});

	it("includes requester data on document request activity feed items", async () => {
		const manager = await registerTenantSession(
			"analytics-document-requester@example.com",
			"Analytics Documents Feed Homes",
		);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Document Feed Property",
		}).expect(201);
		const ownerLink = await grantInvitedOwner(engagement.body.property.id, {
			email: "analytics-document-owner@example.com",
			firstName: "Document",
			lastName: "Owner",
		});
		const createdRequest = await manager.agent
			.post(`/api/property-engagements/${engagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({
				propertyAssetOwnerId: ownerLink.id,
				title: "DNI del propietario",
			})
			.expect(201);

		const response = await manager.agent
			.get("/api/analytics/activity-feed?page=1&pageSize=20")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);
		const documentItem = response.body.items.find(
			(item: { kind: string }) => item.kind === "document_request",
		);

		expect(documentItem).toMatchObject({
			kind: "document_request",
			documentRequestId: createdRequest.body.id,
			documentRequest: {
				title: "DNI del propietario",
				status: "PENDING",
				currentVersion: null,
			},
			owner: {
				email: "analytics-document-owner@example.com",
				ownerFirstName: "Document",
				ownerLastName: "Owner",
			},
			property: {
				engagementId: engagement.body.id,
				title: "Document Feed Property",
			},
			requestedBy: {
				id: manager.userId,
				email: "analytics-document-requester@example.com",
				firstName: "Owner",
			},
		});
	});

	it("filters activity feed by movement and document request kind", async () => {
		const manager = await registerTenantSession(
			"analytics-kind-filter@example.com",
			"Analytics Kind Filter Homes",
		);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Kind Filter Property",
		}).expect(201);
		const ownerLink = await grantInvitedOwner(engagement.body.property.id, {
			email: "analytics-kind-owner@example.com",
			firstName: "Kind",
			lastName: "Owner",
		});
		const movement = await createMovement(
			manager.agent,
			manager.tenantId,
			engagement.body.id,
			{
				type: MovementType.GENERAL_UPDATE,
				observation: "Kind filter movement observation.",
			},
		).expect(201);
		const documentRequest = await manager.agent
			.post(`/api/property-engagements/${engagement.body.id}/document-requests`)
			.set("x-tenant-id", manager.tenantId)
			.send({
				propertyAssetOwnerId: ownerLink.id,
				title: "Escritura",
			})
			.expect(201);

		const movementResponse = await manager.agent
			.get("/api/analytics/activity-feed?page=1&pageSize=20&kind=movement")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);
		const documentResponse = await manager.agent
			.get(
				"/api/analytics/activity-feed?page=1&pageSize=20&kind=document_request",
			)
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(movementResponse.body.total).toBe(1);
		expect(movementResponse.body.items).toEqual([
			expect.objectContaining({
				kind: "movement",
				id: movement.body.id,
				observation: "Kind filter movement observation.",
			}),
		]);
		expect(
			movementResponse.body.items.map((item: { kind: string }) => item.kind),
		).not.toContain("document_request");
		expect(documentResponse.body.total).toBe(1);
		expect(documentResponse.body.items).toEqual([
			expect.objectContaining({
				kind: "document_request",
				documentRequestId: documentRequest.body.id,
				documentRequest: expect.objectContaining({ title: "Escritura" }),
			}),
		]);
		expect(
			documentResponse.body.items.map((item: { kind: string }) => item.kind),
		).not.toContain("movement");
	});

	it("rejects agent access to aggregate pilot reports", async () => {
		const manager = await registerTenantSession(
			"analytics-manager-access@example.com",
			"Analytics Access Homes",
		);
		const agent = await registerTenantSession(
			"analytics-agent-access@example.com",
			"Analytics Agent Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);

		const response = await agent.agent
			.get("/api/analytics/pilot-summary")
			.set("x-tenant-id", manager.tenantId)
			.expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
	});

	async function registerTenantSession(email: string, tenantName: string) {
		const agent = request.agent(app.getHttpServer());
		const response = await agent
			.post("/api/auth/register-tenant")
			.send({ email, password: "password123", firstName: "Owner", tenantName })
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
				title: "Default Analytics Property",
				addressLine: "Analytics Street 123",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.HOUSE,
				operationType: PropertyOperationType.SALE,
				...overrides,
			});
	}

	function createMovement(
		agent: TestAgent,
		tenantId: string,
		engagementId: string,
		overrides: Partial<Record<string, unknown>> = {},
	) {
		return agent
			.post(`/api/property-engagements/${engagementId}/movements`)
			.set("x-tenant-id", tenantId)
			.send({
				type: MovementType.GENERAL_UPDATE,
				observation: "Default analytics movement observation.",
				...overrides,
			});
	}

	async function addTenantAgent(userId: string, tenantId: string) {
		return prisma.tenantMembership.create({
			data: { userId, tenantId, role: TenantRole.AGENT },
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

	async function seedMovementEvent(
		tenantId: string,
		actorUserId: string,
		propertyEngagementId: string,
		occurredAt: Date,
	) {
		return prisma.analyticsEvent.create({
			data: {
				tenantId,
				actorUserId,
				actorType: AnalyticsActorType.INTERNAL_USER,
				eventName: AnalyticsEventName.MOVEMENT_CREATED,
				propertyEngagementId,
				occurredAt,
			},
		});
	}

	async function seedTenantEvent(
		tenantId: string,
		actorUserId: string,
		eventName: AnalyticsEventName,
		occurredAt: Date,
		metadata?: Prisma.InputJsonValue,
	) {
		return prisma.analyticsEvent.create({
			data: {
				tenantId,
				actorUserId,
				actorType: AnalyticsActorType.INTERNAL_USER,
				eventName,
				occurredAt,
				...(metadata === undefined ? {} : { metadata }),
			},
		});
	}
});
