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
import type { INestApplication } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

type TestAgent = ReturnType<typeof request.agent>;

describe("Owner portal (e2e)", () => {
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
		await prisma.analyticsEvent.deleteMany();
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

	it("lists active owned properties without requiring x-tenant-id or leaking owner data", async () => {
		const manager = await registerTenantSession(
			"owner-list-manager@example.com",
			"Owner List Homes",
		);
		const owner = await registerOwnerSession(
			"owner-list@example.com",
			"Owner List Temporary Homes",
		);
		const owned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Owner Visible Apartment",
			addressLine: "Owner Street 100",
			propertyType: PropertyType.APARTMENT,
			ownerName: "Internal Owner Name",
			ownerEmail: "internal-owner@example.com",
		}).expect(201);
		await createEngagement(manager.agent, manager.tenantId, {
			title: "Unassigned Owner House",
		}).expect(201);
		await grantOwnerAccess(owner.userId, owned.body.property.id);

		const response = await owner.agent.get("/api/owner/properties").expect(200);

		expect(response.body).toEqual([
			expect.objectContaining({
				id: owned.body.property.id,
				title: "Owner Visible Apartment",
				addressLine: "Owner Street 100",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.APARTMENT,
			}),
		]);
		expect(response.body[0]).not.toHaveProperty("owners");
		expect(response.body[0]).not.toHaveProperty("ownerName");
		expect(response.body[0]).not.toHaveProperty("ownerEmail");
		await expect(
			prisma.tenantMembership.count({ where: { userId: owner.userId } }),
		).resolves.toBe(0);
	});

	it("ignores misleading x-tenant-id and returns owner-owned properties by active ownership", async () => {
		const manager = await registerTenantSession(
			"owner-header-manager@example.com",
			"Owner Header Homes",
		);
		const otherTenant = await registerTenantSession(
			"owner-header-other-tenant@example.com",
			"Owner Header Other Tenant Homes",
		);
		const owner = await registerOwnerSession(
			"owner-header@example.com",
			"Owner Header Temporary Homes",
		);
		const owned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Header Owned Property",
		}).expect(201);
		await grantOwnerAccess(owner.userId, owned.body.property.id);

		const list = await owner.agent
			.get("/api/owner/properties")
			.set("x-tenant-id", otherTenant.tenantId)
			.expect(200);
		const detail = await owner.agent
			.get(`/api/owner/properties/${owned.body.property.id}`)
			.set("x-tenant-id", otherTenant.tenantId)
			.expect(200);

		expect(list.body.map((property: { id: string }) => property.id)).toEqual([
			owned.body.property.id,
		]);
		expect(detail.body).toMatchObject({
			id: owned.body.property.id,
			title: "Header Owned Property",
		});
		await expect(
			prisma.tenantMembership.count({ where: { userId: owner.userId } }),
		).resolves.toBe(0);
	});

	it("returns property detail only to the active owner and hides inaccessible resources as 404", async () => {
		const manager = await registerTenantSession(
			"owner-detail-manager@example.com",
			"Owner Detail Homes",
		);
		const owner = await registerOwnerSession(
			"owner-detail@example.com",
			"Owner Detail Temporary Homes",
		);
		const otherOwner = await registerOwnerSession(
			"other-owner-detail@example.com",
			"Other Owner Detail Temporary Homes",
		);
		const owned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Owned Detail House",
			totalAreaSqm: 320,
			coveredAreaSqm: 180,
			rooms: 5,
			bedrooms: 3,
			bathrooms: 2,
			garages: 1,
			ageYears: 12,
			orientation: "N",
		}).expect(201);
		const revoked = await createEngagement(manager.agent, manager.tenantId, {
			title: "Revoked Detail House",
		}).expect(201);
		await grantOwnerAccess(owner.userId, owned.body.property.id);
		await createPropertyImage(owner.userId, owned.body.property.id, {
			isPrimary: true,
			storageKey: "property-images/test-owner-detail/primary.webp",
		});
		await grantOwnerAccess(
			owner.userId,
			revoked.body.property.id,
			PropertyAssetOwnerAccessStatus.REVOKED,
		);

		const visible = await owner.agent
			.get(`/api/owner/properties/${owned.body.property.id}`)
			.expect(200);
		const otherOwnerResponse = await otherOwner.agent
			.get(`/api/owner/properties/${owned.body.property.id}`)
			.expect(404);
		const revokedResponse = await owner.agent
			.get(`/api/owner/properties/${revoked.body.property.id}`)
			.expect(404);

		expect(visible.body).toMatchObject({
			id: owned.body.property.id,
			title: "Owned Detail House",
			totalAreaSqm: 320,
			coveredAreaSqm: 180,
			rooms: 5,
			bedrooms: 3,
			bathrooms: 2,
			garages: 1,
			ageYears: 12,
			orientation: "N",
			primaryImage: expect.objectContaining({
				isPrimary: true,
				storageKey: "property-images/test-owner-detail/primary.webp",
			}),
		});
		expect(visible.body.images).toEqual([
			expect.objectContaining({
				isPrimary: true,
				storageKey: "property-images/test-owner-detail/primary.webp",
			}),
		]);
		expect(visible.body).not.toHaveProperty("owners");
		expect(otherOwnerResponse.body.message).toBe("Owner property not found");
		expect(revokedResponse.body.message).toBe("Owner property not found");
	});

	it("lists owner property engagements with sanitized tenant and agent fields", async () => {
		const manager = await registerTenantSession(
			"owner-engagements-manager@example.com",
			"Owner Engagements Homes",
		);
		const agent = await registerTenantSession(
			"owner-engagements-agent@example.com",
			"Owner Engagements Agent Homes",
		);
		const owner = await registerOwnerSession(
			"owner-engagements@example.com",
			"Owner Engagements Temporary Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const engagement = await createEngagement(manager.agent, manager.tenantId, {
			title: "Owner Engagement Property",
			operationType: PropertyOperationType.SALE,
			publishedPriceCents: 150_000_00,
			currency: "USD",
		}).expect(201);
		await assignAgent(
			manager.agent,
			manager.tenantId,
			engagement.body.id,
			agent.userId,
		).expect(201);
		await grantOwnerAccess(owner.userId, engagement.body.property.id);

		const response = await owner.agent
			.get(`/api/owner/properties/${engagement.body.property.id}/engagements`)
			.expect(200);

		expect(response.body).toEqual([
			expect.objectContaining({
				id: engagement.body.id,
				tenant: { id: manager.tenantId, name: "Owner Engagements Homes" },
				operationType: PropertyOperationType.SALE,
				status: PropertyEngagementStatus.CAPTURE,
				publishedPriceCents: 150_000_00,
				currency: "USD",
				agents: [
					{
						userId: agent.userId,
						firstName: "Owner",
						email: "owner-engagements-agent@example.com",
					},
				],
			}),
		]);
		expect(response.body[0]).not.toHaveProperty("tenantId");
		expect(response.body[0]).not.toHaveProperty("propertyAssetId");
		expect(response.body[0].agents[0]).not.toHaveProperty("assignedByUserId");
	});

	it("tracks owner WhatsApp contact clicks without sensitive metadata", async () => {
		const manager = await registerTenantSession(
			"owner-whatsapp-manager@example.com",
			"Owner WhatsApp Homes",
		);
		const owner = await registerOwnerSession(
			"owner-whatsapp@example.com",
			"Owner WhatsApp Temporary Homes",
		);
		const otherOwner = await registerOwnerSession(
			"other-owner-whatsapp@example.com",
			"Other Owner WhatsApp Temporary Homes",
		);
		const owned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Owner WhatsApp Property",
			addressLine: "Sensitive Address 123",
		}).expect(201);
		const hidden = await createEngagement(manager.agent, manager.tenantId, {
			title: "Hidden WhatsApp Property",
		}).expect(201);
		await grantOwnerAccess(owner.userId, owned.body.property.id);

		await owner.agent
			.post(`/api/owner/engagements/${owned.body.id}/whatsapp-contact-click`)
			.expect(204);
		const hiddenResponse = await otherOwner.agent
			.post(`/api/owner/engagements/${owned.body.id}/whatsapp-contact-click`)
			.expect(404);
		await owner.agent
			.post(`/api/owner/engagements/${hidden.body.id}/whatsapp-contact-click`)
			.expect(404);

		const event = await prisma.analyticsEvent.findFirstOrThrow({
			where: {
				eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
				propertyEngagementId: owned.body.id,
			},
		});

		expect(event).toMatchObject({
			tenantId: manager.tenantId,
			actorUserId: owner.userId,
			actorType: AnalyticsActorType.OWNER,
			eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
			propertyEngagementId: owned.body.id,
			propertyAssetId: owned.body.property.id,
		});
		expect(event.metadata).toEqual({
			context: "property",
			targetType: "tenant",
		});
		expect(JSON.stringify(event.metadata)).not.toContain("549");
		expect(JSON.stringify(event.metadata)).not.toContain("Sensitive Address");
		expect(JSON.stringify(event.metadata)).not.toContain(
			"owner-whatsapp@example.com",
		);
		expect(hiddenResponse.body.message).toBe("Owner engagement not found");
	});

	it("tracks owner movement WhatsApp contact clicks without sensitive metadata", async () => {
		const manager = await registerTenantSession(
			"owner-movement-whatsapp-manager@example.com",
			"Owner Movement WhatsApp Homes",
		);
		const owner = await registerOwnerSession(
			"owner-movement-whatsapp@example.com",
			"Owner Movement WhatsApp Temporary Homes",
		);
		const otherOwner = await registerOwnerSession(
			"other-owner-movement-whatsapp@example.com",
			"Other Owner Movement WhatsApp Temporary Homes",
		);
		const owned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Owner Movement WhatsApp Property",
			addressLine: "Sensitive Movement Address 123",
		}).expect(201);
		const hidden = await createEngagement(manager.agent, manager.tenantId, {
			title: "Hidden Movement WhatsApp Property",
		}).expect(201);
		await grantOwnerAccess(owner.userId, owned.body.property.id);
		const visibleMovement = await createMovement(
			manager.agent,
			manager.tenantId,
			owned.body.id,
			{ observation: "Visible movement question." },
		).expect(201);
		const hiddenMovement = await createMovement(
			manager.agent,
			manager.tenantId,
			hidden.body.id,
			{ observation: "Hidden movement question." },
		).expect(201);

		await owner.agent
			.post(
				`/api/owner/engagements/${owned.body.id}/movements/${visibleMovement.body.id}/whatsapp-contact-click`,
			)
			.expect(204);
		const hiddenOwnerResponse = await otherOwner.agent
			.post(
				`/api/owner/engagements/${owned.body.id}/movements/${visibleMovement.body.id}/whatsapp-contact-click`,
			)
			.expect(404);
		await owner.agent
			.post(
				`/api/owner/engagements/${owned.body.id}/movements/${hiddenMovement.body.id}/whatsapp-contact-click`,
			)
			.expect(404);

		const event = await prisma.analyticsEvent.findFirstOrThrow({
			where: {
				eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
				movementId: visibleMovement.body.id,
			},
		});

		expect(event).toMatchObject({
			tenantId: manager.tenantId,
			actorUserId: owner.userId,
			actorType: AnalyticsActorType.OWNER,
			eventName: AnalyticsEventName.WHATSAPP_CONTACT_CLICKED,
			propertyEngagementId: owned.body.id,
			propertyAssetId: owned.body.property.id,
			movementId: visibleMovement.body.id,
		});
		expect(event.metadata).toEqual({
			context: "movement",
			targetType: "movement_author",
		});
		expect(JSON.stringify(event.metadata)).not.toContain("549");
		expect(JSON.stringify(event.metadata)).not.toContain(
			"Sensitive Movement Address",
		);
		expect(JSON.stringify(event.metadata)).not.toContain(
			"owner-movement-whatsapp@example.com",
		);
		expect(JSON.stringify(event.metadata)).not.toContain(
			"owner-movement-whatsapp-manager@example.com",
		);
		expect(hiddenOwnerResponse.body.message).toBe("Owner movement not found");
	});

	it("returns the owner timeline for owned engagements and 404 for non-owned engagements", async () => {
		const manager = await registerTenantSession(
			"owner-timeline-manager@example.com",
			"Owner Timeline Homes",
		);
		await prisma.user.update({
			where: { id: manager.userId },
			data: { whatsappPhone: "+5493510000000" },
		});
		const owner = await registerOwnerSession(
			"owner-timeline@example.com",
			"Owner Timeline Temporary Homes",
		);
		const owned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Owner Timeline Property",
		}).expect(201);
		const hidden = await createEngagement(manager.agent, manager.tenantId, {
			title: "Hidden Timeline Property",
		}).expect(201);
		await grantOwnerAccess(owner.userId, owned.body.property.id);
		const movement = await createMovement(
			manager.agent,
			manager.tenantId,
			owned.body.id,
			{
				type: MovementType.STATUS_CHANGE,
				observation: "Publication is now live.",
				nextStep: "Review inquiries tomorrow.",
				newStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
				interestCount: 4,
				visitCount: 2,
				interestLevel: "HIGH",
			},
		).expect(201);
		await createMovement(manager.agent, manager.tenantId, hidden.body.id, {
			observation: "This hidden movement must not be visible.",
		}).expect(201);

		const visible = await owner.agent
			.get(
				`/api/owner/engagements/${owned.body.id}/timeline?page=1&pageSize=10&order=asc`,
			)
			.expect(200);
		const hiddenResponse = await owner.agent
			.get(`/api/owner/engagements/${hidden.body.id}/timeline`)
			.expect(404);

		expect(visible.body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
		expect(visible.body.engagement).toMatchObject({
			id: owned.body.id,
			tenant: { id: manager.tenantId },
		});
		expect(visible.body.items).toEqual([
			expect.objectContaining({
				id: movement.body.id,
				propertyEngagementId: owned.body.id,
				type: MovementType.STATUS_CHANGE,
				observation: "Publication is now live.",
				nextStep: "Review inquiries tomorrow.",
				newStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
				interestCount: 4,
				visitCount: 2,
				interestLevel: "HIGH",
				createdBy: {
					id: manager.userId,
					email: "owner-timeline-manager@example.com",
					firstName: "Owner",
				},
				contact: {
					available: true,
					targetType: "movement_author",
					displayLabel: "Consultar responsable",
					whatsappPhone: "+5493510000000",
				},
			}),
		]);
		expect(visible.body.items[0].createdBy).not.toHaveProperty("passwordHash");
		expect(visible.body.items[0].createdBy).not.toHaveProperty("whatsappPhone");
		expect(hiddenResponse.body.message).toBe("Owner engagement not found");
	});

	it("rejects unauthenticated owner requests", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/owner/properties")
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
				firstName: "Owner",
				tenantName,
			})
			.expect(201);

		return {
			agent,
			userId: response.body.user.id as string,
			tenantId: response.body.memberships[0].tenant.id as string,
		};
	}

	async function registerOwnerSession(email: string, tenantName: string) {
		const owner = await registerTenantSession(email, tenantName);
		await prisma.tenantMembership.deleteMany({
			where: { userId: owner.userId },
		});
		return owner;
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
				title: "Default Owner Portal Property",
				addressLine: "Owner Portal Street 123",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.HOUSE,
				operationType: PropertyOperationType.RENT,
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
				observation: "Default owner timeline movement.",
				...overrides,
			});
	}

	function assignAgent(
		agent: TestAgent,
		tenantId: string,
		engagementId: string,
		agentUserId: string,
	) {
		return agent
			.post(`/api/property-engagements/${engagementId}/agents`)
			.set("x-tenant-id", tenantId)
			.send({ agentUserId });
	}

	async function addTenantAgent(userId: string, tenantId: string) {
		return prisma.tenantMembership.create({
			data: {
				userId,
				tenantId,
				role: TenantRole.AGENT,
			},
		});
	}

	async function createPropertyImage(
		uploadedByUserId: string,
		propertyAssetId: string,
		overrides: Partial<{
			isPrimary: boolean;
			storageKey: string;
		}> = {},
	) {
		return prisma.propertyAssetImage.create({
			data: {
				propertyAssetId,
				uploadedByUserId,
				storageKey:
					overrides.storageKey ??
					`property-images/test-owner-portal/${propertyAssetId}.webp`,
				originalFilename: "owner-property.webp",
				mimeType: "image/webp",
				sizeBytes: 1024,
				isPrimary: overrides.isPrimary ?? false,
			},
		});
	}

	async function grantOwnerAccess(
		userId: string,
		propertyAssetId: string,
		accessStatus: PropertyAssetOwnerAccessStatus = PropertyAssetOwnerAccessStatus.ACTIVE,
	) {
		const owner = await prisma.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true, firstName: true, lastName: true },
		});

		return prisma.propertyAssetOwner.create({
			data: {
				userId,
				propertyAssetId,
				ownerEmail: owner.email,
				ownerFirstName: owner.firstName,
				ownerLastName: owner.lastName ?? "",
				accessStatus,
			},
		});
	}
});
