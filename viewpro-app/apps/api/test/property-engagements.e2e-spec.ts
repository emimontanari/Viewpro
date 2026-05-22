import {
	PropertyOperationType,
	PropertyType,
	TenantRole,
} from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

type TestAgent = ReturnType<typeof request.agent>;

describe("Property engagements (e2e)", () => {
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
		await prisma.movement.deleteMany();
		await prisma.propertyAgent.deleteMany();
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

	it("allows a manager to create a property asset and tenant-scoped engagement with x-tenant-id", async () => {
		const manager = await registerTenantSession(
			"manager-create@example.com",
			"Manager Create Homes",
		);

		const response = await createEngagement(manager.agent, manager.tenantId, {
			title: "Bright Palermo Apartment",
			addressLine: "Av. Santa Fe 1234",
			city: "Buenos Aires",
			province: "CABA",
			propertyType: PropertyType.APARTMENT,
			ownerName: "Property Owner",
			ownerEmail: "owner@example.com",
			totalAreaSqm: 72,
			coveredAreaSqm: 64,
			rooms: 3,
			bedrooms: 2,
			bathrooms: 1,
			garages: 1,
			ageYears: 8,
			orientation: "NE",
			operationType: PropertyOperationType.SALE,
			publishedPriceCents: 12500000,
			currency: "USD",
		}).expect(201);

		expect(response.body).toMatchObject({
			tenantId: manager.tenantId,
			operationType: PropertyOperationType.SALE,
			status: "CAPTURE",
			publishedPriceCents: 12500000,
			currency: "USD",
			property: {
				title: "Bright Palermo Apartment",
				addressLine: "Av. Santa Fe 1234",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.APARTMENT,
				totalAreaSqm: 72,
				coveredAreaSqm: 64,
				rooms: 3,
				bedrooms: 2,
				bathrooms: 1,
				garages: 1,
				ageYears: 8,
				orientation: "NE",
				ownerName: "Property Owner",
				ownerEmail: "owner@example.com",
			},
			agents: [],
		});

		await expect(prisma.propertyAsset.count()).resolves.toBe(1);
		await expect(
			prisma.propertyEngagement.count({
				where: { tenantId: manager.tenantId },
			}),
		).resolves.toBe(1);
	});

	it("rejects property engagement endpoints without x-tenant-id", async () => {
		const manager = await registerTenantSession(
			"missing-tenant-engagement@example.com",
			"Missing Tenant Engagements",
		);

		const response = await manager.agent
			.get("/api/property-engagements")
			.expect(403);

		expect(response.body.message).toBe("Tenant context required");
	});

	it("does not list another tenant engagement", async () => {
		const tenantA = await registerTenantSession(
			"tenant-a-list@example.com",
			"Tenant A List Homes",
		);
		const tenantB = await registerTenantSession(
			"tenant-b-list@example.com",
			"Tenant B List Homes",
		);
		await createEngagement(tenantB.agent, tenantB.tenantId, {
			title: "Tenant B House",
		}).expect(201);

		const response = await tenantA.agent
			.get("/api/property-engagements")
			.set("x-tenant-id", tenantA.tenantId)
			.expect(200);

		expect(response.body).toMatchObject({
			total: 0,
			page: 1,
			pageSize: 20,
			items: [],
		});
	});

	it("returns 404 when reading another tenant engagement by id", async () => {
		const tenantA = await registerTenantSession(
			"tenant-a-read@example.com",
			"Tenant A Read Homes",
		);
		const tenantB = await registerTenantSession(
			"tenant-b-read@example.com",
			"Tenant B Read Homes",
		);
		const created = await createEngagement(tenantB.agent, tenantB.tenantId, {
			title: "Tenant B Hidden House",
		}).expect(201);

		const response = await tenantA.agent
			.get(`/api/property-engagements/${created.body.id}`)
			.set("x-tenant-id", tenantA.tenantId)
			.expect(404);

		expect(response.body.message).toBe("Property engagement not found");
	});

	it("allows a manager to update property asset and engagement fields", async () => {
		const manager = await registerTenantSession(
			"manager-update@example.com",
			"Manager Update Homes",
		);
		const created = await createEngagement(manager.agent, manager.tenantId, {
			title: "Original Property",
			publishedPriceCents: 12500000,
		}).expect(201);

		const response = await manager.agent
			.patch(`/api/property-engagements/${created.body.id}`)
			.set("x-tenant-id", manager.tenantId)
			.send({
				title: "Updated Property",
				addressLine: "Updated Street 456",
				city: "Córdoba",
				province: "Córdoba",
				propertyType: PropertyType.HOUSE,
				totalAreaSqm: 120,
				coveredAreaSqm: 98,
				rooms: 4,
				bedrooms: 3,
				bathrooms: 2,
				garages: 1,
				ageYears: 12,
				orientation: "NO",
				ownerName: "Updated Owner",
				ownerEmail: "updated-owner@example.com",
				operationType: PropertyOperationType.SALE,
				publishedPriceCents: 30000000,
				currency: "USD",
			})
			.expect(200);

		expect(response.body).toMatchObject({
			id: created.body.id,
			tenantId: manager.tenantId,
			operationType: PropertyOperationType.SALE,
			publishedPriceCents: 30000000,
			currency: "USD",
			property: {
				title: "Updated Property",
				addressLine: "Updated Street 456",
				city: "Córdoba",
				province: "Córdoba",
				propertyType: PropertyType.HOUSE,
				totalAreaSqm: 120,
				coveredAreaSqm: 98,
				rooms: 4,
				bedrooms: 3,
				bathrooms: 2,
				garages: 1,
				ageYears: 12,
				orientation: "NO",
				ownerName: "Updated Owner",
				ownerEmail: "updated-owner@example.com",
			},
		});

		await expect(
			prisma.propertyAsset.findUnique({
				where: { id: created.body.property.id },
				select: { title: true, bedrooms: true },
			}),
		).resolves.toEqual({ title: "Updated Property", bedrooms: 3 });
	});

	it("returns 404 when updating another tenant engagement", async () => {
		const tenantA = await registerTenantSession(
			"tenant-a-update@example.com",
			"Tenant A Update Homes",
		);
		const tenantB = await registerTenantSession(
			"tenant-b-update@example.com",
			"Tenant B Update Homes",
		);
		const created = await createEngagement(tenantB.agent, tenantB.tenantId, {
			title: "Tenant B Update Property",
		}).expect(201);

		const response = await tenantA.agent
			.patch(`/api/property-engagements/${created.body.id}`)
			.set("x-tenant-id", tenantA.tenantId)
			.send({ title: "Leaked update" })
			.expect(404);

		expect(response.body.message).toBe("Property engagement not found");
	});

	it("allows a manager to list all tenant engagements with pagination", async () => {
		const manager = await registerTenantSession(
			"manager-list@example.com",
			"Manager List Homes",
		);
		const first = await createEngagement(manager.agent, manager.tenantId, {
			title: "First Tenant Property",
		}).expect(201);
		const second = await createEngagement(manager.agent, manager.tenantId, {
			title: "Second Tenant Property",
		}).expect(201);

		const response = await manager.agent
			.get("/api/property-engagements?page=1&pageSize=1")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.total).toBe(2);
		expect(response.body.page).toBe(1);
		expect(response.body.pageSize).toBe(1);
		expect(response.body.items).toHaveLength(1);
		expect([first.body.id, second.body.id]).toContain(
			response.body.items[0].id,
		);
	});

	it("allows an agent to list only assigned tenant engagements", async () => {
		const manager = await registerTenantSession(
			"manager-agent-list@example.com",
			"Manager Agent List Homes",
		);
		const agent = await registerTenantSession(
			"assigned-agent-list@example.com",
			"Assigned Agent List Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const assigned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Assigned Property",
		}).expect(201);
		const unassigned = await createEngagement(manager.agent, manager.tenantId, {
			title: "Unassigned Property",
		}).expect(201);
		await manager.agent
			.post(`/api/property-engagements/${assigned.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(201);

		const response = await agent.agent
			.get("/api/property-engagements")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.total).toBe(1);
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0].id).toBe(assigned.body.id);
		expect(
			response.body.items.map((item: { id: string }) => item.id),
		).not.toContain(unassigned.body.id);
	});

	it("rejects engagement creation by an agent", async () => {
		const manager = await registerTenantSession(
			"manager-agent-create@example.com",
			"Manager Agent Create Homes",
		);
		const agent = await registerTenantSession(
			"agent-cannot-create@example.com",
			"Agent Cannot Create Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);

		const response = await createEngagement(agent.agent, manager.tenantId, {
			title: "Agent Forbidden Property",
		}).expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
	});

	it("allows a manager to assign an agent who belongs to the tenant", async () => {
		const manager = await registerTenantSession(
			"manager-assign@example.com",
			"Manager Assign Homes",
		);
		const agent = await registerTenantSession(
			"agent-assign@example.com",
			"Agent Assign Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const created = await createEngagement(manager.agent, manager.tenantId, {
			title: "Assignable Property",
		}).expect(201);

		const response = await manager.agent
			.post(`/api/property-engagements/${created.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(201);

		expect(response.body).toMatchObject({
			tenantId: manager.tenantId,
			propertyEngagementId: created.body.id,
			agentUserId: agent.userId,
			assignedByUserId: manager.userId,
		});
		await expect(
			prisma.propertyAgent.count({
				where: { tenantId: manager.tenantId, agentUserId: agent.userId },
			}),
		).resolves.toBe(1);
	});

	it("rejects assigning a user outside the tenant", async () => {
		const manager = await registerTenantSession(
			"manager-outside-agent@example.com",
			"Manager Outside Agent Homes",
		);
		const outsideUser = await registerTenantSession(
			"outside-agent@example.com",
			"Outside Agent Homes",
		);
		const created = await createEngagement(manager.agent, manager.tenantId, {
			title: "Outside Agent Property",
		}).expect(201);

		const response = await manager.agent
			.post(`/api/property-engagements/${created.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: outsideUser.userId })
			.expect(400);

		expect(response.body.message).toBe("Agent is not a member of this tenant");
	});

	it("returns conflict when assigning the same agent twice", async () => {
		const manager = await registerTenantSession(
			"manager-duplicate-agent@example.com",
			"Manager Duplicate Homes",
		);
		const agent = await registerTenantSession(
			"agent-duplicate@example.com",
			"Agent Duplicate Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const created = await createEngagement(manager.agent, manager.tenantId, {
			title: "Duplicate Agent Property",
		}).expect(201);

		await manager.agent
			.post(`/api/property-engagements/${created.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(201);

		const response = await manager.agent
			.post(`/api/property-engagements/${created.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(409);

		expect(response.body.message).toBe(
			"Agent is already assigned to this property engagement",
		);
		await expect(
			prisma.propertyAgent.count({
				where: { tenantId: manager.tenantId, agentUserId: agent.userId },
			}),
		).resolves.toBe(1);
	});

	it("allows a manager to remove an assigned agent", async () => {
		const manager = await registerTenantSession(
			"manager-remove-agent@example.com",
			"Manager Remove Homes",
		);
		const agent = await registerTenantSession(
			"agent-remove@example.com",
			"Agent Remove Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const created = await createEngagement(manager.agent, manager.tenantId, {
			title: "Remove Agent Property",
		}).expect(201);
		const assignment = await manager.agent
			.post(`/api/property-engagements/${created.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(201);

		const response = await manager.agent
			.delete(
				`/api/property-engagements/${created.body.id}/agents/${assignment.body.id}`,
			)
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body).toEqual({ deleted: true, id: assignment.body.id });
		await expect(
			prisma.propertyAgent.count({ where: { id: assignment.body.id } }),
		).resolves.toBe(0);
	});

	it("returns 404 when removing an unrelated agent assignment", async () => {
		const manager = await registerTenantSession(
			"manager-unrelated-agent@example.com",
			"Manager Unrelated Homes",
		);
		const agent = await registerTenantSession(
			"agent-unrelated@example.com",
			"Agent Unrelated Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const first = await createEngagement(manager.agent, manager.tenantId, {
			title: "First Agent Property",
		}).expect(201);
		const second = await createEngagement(manager.agent, manager.tenantId, {
			title: "Second Agent Property",
		}).expect(201);
		const assignment = await manager.agent
			.post(`/api/property-engagements/${first.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(201);

		const response = await manager.agent
			.delete(
				`/api/property-engagements/${second.body.id}/agents/${assignment.body.id}`,
			)
			.set("x-tenant-id", manager.tenantId)
			.expect(404);

		expect(response.body.message).toBe("Property agent assignment not found");
		await expect(
			prisma.propertyAgent.count({ where: { id: assignment.body.id } }),
		).resolves.toBe(1);
	});

	it("rejects removing an assigned agent by an agent user", async () => {
		const manager = await registerTenantSession(
			"manager-agent-remove-forbidden@example.com",
			"Manager Remove Forbidden",
		);
		const agent = await registerTenantSession(
			"agent-remove-forbidden@example.com",
			"Agent Remove Forbidden",
		);
		await addTenantAgent(agent.userId, manager.tenantId);
		const created = await createEngagement(manager.agent, manager.tenantId, {
			title: "Remove Forbidden Property",
		}).expect(201);
		const assignment = await manager.agent
			.post(`/api/property-engagements/${created.body.id}/agents`)
			.set("x-tenant-id", manager.tenantId)
			.send({ agentUserId: agent.userId })
			.expect(201);

		const response = await agent.agent
			.delete(
				`/api/property-engagements/${created.body.id}/agents/${assignment.body.id}`,
			)
			.set("x-tenant-id", manager.tenantId)
			.expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
		await expect(
			prisma.propertyAgent.count({ where: { id: assignment.body.id } }),
		).resolves.toBe(1);
	});

	it("lists assignable tenant members for managers", async () => {
		const manager = await registerTenantSession(
			"manager-assignable-list@example.com",
			"Manager Assignable Homes",
		);
		const agent = await registerTenantSession(
			"agent-assignable-list@example.com",
			"Agent Assignable Homes",
		);
		await addTenantAgent(agent.userId, manager.tenantId);

		const response = await manager.agent
			.get("/api/property-engagements/assignable-agents")
			.set("x-tenant-id", manager.tenantId)
			.expect(200);

		expect(response.body.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					userId: manager.userId,
					email: "manager-assignable-list@example.com",
					firstName: "Owner",
					role: TenantRole.PRINCIPAL_MANAGER,
				}),
				expect.objectContaining({
					userId: agent.userId,
					email: "agent-assignable-list@example.com",
					firstName: "Owner",
					role: TenantRole.AGENT,
				}),
			]),
		);
	});

	it("rejects assignable tenant members listing for agents", async () => {
		const manager = await registerTenantSession(
			"manager-assignable-forbidden@example.com",
			"Manager Assignable Forbidden",
		);
		const agent = await registerTenantSession(
			"agent-assignable-forbidden@example.com",
			"Agent Assignable Forbidden",
		);
		await addTenantAgent(agent.userId, manager.tenantId);

		const response = await agent.agent
			.get("/api/property-engagements/assignable-agents")
			.set("x-tenant-id", manager.tenantId)
			.expect(403);

		expect(response.body.message).toBe("Insufficient permissions");
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

	async function addTenantAgent(userId: string, tenantId: string) {
		return prisma.tenantMembership.create({
			data: {
				userId,
				tenantId,
				role: TenantRole.AGENT,
			},
		});
	}
});
