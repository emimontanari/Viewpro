import type { INestApplication } from "@nestjs/common";
import {
	AnalyticsActorType,
	AnalyticsEventName,
	DocumentRequestStatus,
	GlobalRole,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
	TenantStatus,
} from "@prisma/client";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApiApp } from "../src/bootstrap/create-app";
import { PrismaService } from "../src/database/prisma.service";

describe("Admin access (e2e)", () => {
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
		await prisma.propertyAssetOwner.deleteMany();
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

	it("rejects unauthenticated admin access with 401", async () => {
		const response = await request(app.getHttpServer())
			.get("/api/admin/access-check")
			.expect(401);

		expect(response.body.message).toBe("Authentication required");
	});

	it.each([
		TenantRole.PRINCIPAL_MANAGER,
		TenantRole.MANAGER,
		TenantRole.AGENT,
	])("rejects USER with %s tenant membership with 403", async (role) => {
		const { agent, tenantId, userId } = await registerTenantSession(
			`${role.toLowerCase()}@example.com`,
			`${role} Homes`,
		);
		await prisma.tenantMembership.update({
			where: { userId_tenantId: { userId, tenantId } },
			data: { role },
		});

		const response = await agent
			.get("/api/admin/access-check")
			.set("x-tenant-id", tenantId)
			.expect(403);

		expect(response.body.message).toBe("ViewPro admin access required");
	});

	it("allows VIEWPRO_ADMIN access with a minimal sanitized response", async () => {
		const { agent, userId } = await registerTenantSession(
			"admin@example.com",
			"Admin Homes",
		);
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		const response = await agent.get("/api/admin/access-check").expect(200);

		expect(response.body).toEqual({
			access: "granted",
			globalRole: GlobalRole.VIEWPRO_ADMIN,
		});
	});

	it("allows VIEWPRO_ADMIN access without x-tenant-id", async () => {
		const { agent, userId } = await registerTenantSession(
			"admin-no-tenant@example.com",
			"Admin No Tenant Homes",
		);
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		await agent.get("/api/admin/access-check").expect(200);
	});

	it("allows VIEWPRO_ADMIN access with an arbitrary x-tenant-id", async () => {
		const { agent, userId } = await registerTenantSession(
			"admin-arbitrary-tenant@example.com",
			"Admin Arbitrary Tenant Homes",
		);
		const arbitraryTenant = await prisma.tenant.create({
			data: {
				name: "Arbitrary Header Tenant",
				slug: "arbitrary-header-tenant",
			},
		});
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		const response = await agent
			.get("/api/admin/access-check")
			.set("x-tenant-id", arbitraryTenant.id)
			.expect(200);

		expect(response.body).toEqual({
			access: "granted",
			globalRole: GlobalRole.VIEWPRO_ADMIN,
		});
	});

	it("does not derive admin access from a tenant header", async () => {
		const { agent, tenantId } = await registerTenantSession(
			"tenant-header@example.com",
			"Tenant Header Homes",
		);

		const response = await agent
			.get("/api/admin/access-check")
			.set("x-tenant-id", tenantId)
			.expect(403);

		expect(response.body.message).toBe("ViewPro admin access required");
	});

	it("does not derive admin access from an arbitrary x-tenant-id", async () => {
		const { agent } = await registerTenantSession(
			"tenant-arbitrary-header@example.com",
			"Tenant Arbitrary Header Homes",
		);
		const arbitraryTenant = await prisma.tenant.create({
			data: {
				name: "Non Member Header Tenant",
				slug: "non-member-header-tenant",
			},
		});

		const response = await agent
			.get("/api/admin/access-check")
			.set("x-tenant-id", arbitraryTenant.id)
			.expect(403);

		expect(response.body.message).toBe("ViewPro admin access required");
	});

	it.each([
		"/api/admin/summary",
		"/api/admin/tenants",
		"/api/admin/activity",
	])("rejects unauthenticated %s access with 401", async (route) => {
		const response = await request(app.getHttpServer()).get(route).expect(401);

		expect(response.body.message).toBe("Authentication required");
	});

	it.each([
		"/api/admin/summary",
		"/api/admin/tenants",
		"/api/admin/activity",
	])("rejects USER access to %s with 403 even with x-tenant-id", async (route) => {
		const { agent, tenantId } = await registerTenantSession(
			`user-${route.split("/").pop()}@example.com`,
			"User Homes",
		);

		const response = await agent
			.get(route)
			.set("x-tenant-id", tenantId)
			.expect(403);

		expect(response.body.message).toBe("ViewPro admin access required");
	});

	it.each([
		"/api/admin/summary",
		"/api/admin/tenants",
		"/api/admin/activity",
	])("allows VIEWPRO_ADMIN access to %s without x-tenant-id", async (route) => {
		const { agent, userId } = await registerTenantSession(
			`admin-${route.split("/").pop()}@example.com`,
			"Admin Homes",
		);
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		await agent.get(route).expect(200);
	});

	it.each([
		"/api/admin/summary",
		"/api/admin/tenants",
		"/api/admin/activity",
	])("allows VIEWPRO_ADMIN access to %s with an arbitrary x-tenant-id", async (route) => {
		const { agent, userId } = await registerTenantSession(
			`admin-arbitrary-${route.split("/").pop()}@example.com`,
			"Admin Arbitrary Homes",
		);
		const arbitraryTenant = await prisma.tenant.create({
			data: {
				name: `Arbitrary ${route}`,
				slug: `arbitrary-${route.split("/").pop()}`,
			},
		});
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		await agent.get(route).set("x-tenant-id", arbitraryTenant.id).expect(200);
	});

	it("returns a sanitized admin summary with aggregate fields only", async () => {
		const { agent, userId } = await registerTenantSession(
			"summary-admin@example.com",
			"Summary Admin Homes",
		);
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		await seedAdminReadModelFixture();

		const response = await agent.get("/api/admin/summary").expect(200);

		expect(response.body).toEqual({
			totals: {
				tenants: 3,
				activeTenants: 1,
				users: 3,
				activeEngagements: 1,
				documentRequests: 1,
				analyticsEvents: 2,
			},
			recentActivityCount: 2,
			generatedAt: expect.any(String),
		});
		expect(new Date(response.body.generatedAt).toString()).not.toBe(
			"Invalid Date",
		);
		expectNoSensitiveFields(response.body);
	});

	it("returns paginated sanitized tenant read models with counts and last activity", async () => {
		const { agent, userId } = await registerTenantSession(
			"tenants-admin@example.com",
			"Tenants Admin Homes",
		);
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const fixture = await seedAdminReadModelFixture();

		const response = await agent
			.get("/api/admin/tenants")
			.query({ status: TenantStatus.ACTIVE, page: 1, pageSize: 10 })
			.expect(200);

		expect(response.body.total).toBe(1);
		expect(response.body.page).toBe(1);
		expect(response.body.pageSize).toBe(10);
		expect(response.body.items).toHaveLength(1);
		expect(response.body.items[0]).toEqual({
			id: fixture.activeTenantId,
			name: "Active Realty",
			slug: "active-realty",
			status: TenantStatus.ACTIVE,
			createdAt: expect.any(String),
			updatedAt: expect.any(String),
			counts: {
				memberships: 1,
				propertyAssets: 1,
				propertyEngagements: 1,
				documentRequests: 1,
				analyticsEvents: 2,
			},
			lastActivityAt: fixture.latestAnalyticsOccurredAt,
		});
		expectNoSensitiveFields(response.body);
	});

	it("returns paginated sanitized admin activity without raw metadata or user identity fields", async () => {
		const { agent, userId } = await registerTenantSession(
			"activity-admin@example.com",
			"Activity Admin Homes",
		);
		await prisma.user.update({
			where: { id: userId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const fixture = await seedAdminReadModelFixture();

		const response = await agent
			.get("/api/admin/activity")
			.query({ tenantId: fixture.activeTenantId, page: 1, pageSize: 10 })
			.expect(200);

		expect(response.body).toEqual({
			total: 2,
			page: 1,
			pageSize: 10,
			items: [
				{
					id: fixture.latestAnalyticsEventId,
					tenantId: fixture.activeTenantId,
					eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
					actorType: AnalyticsActorType.INTERNAL_USER,
					propertyEngagementId: fixture.engagementId,
					propertyAssetId: fixture.propertyAssetId,
					documentRequestId: fixture.documentRequestId,
					movementId: null,
					occurredAt: fixture.latestAnalyticsOccurredAt,
				},
				{
					id: fixture.earlierAnalyticsEventId,
					tenantId: fixture.activeTenantId,
					eventName: AnalyticsEventName.MOVEMENT_CREATED,
					actorType: AnalyticsActorType.SYSTEM,
					propertyEngagementId: fixture.engagementId,
					propertyAssetId: fixture.propertyAssetId,
					documentRequestId: null,
					movementId: null,
					occurredAt: fixture.earlierAnalyticsOccurredAt,
				},
			],
		});
		expectNoSensitiveFields(response.body);
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

	async function seedAdminReadModelFixture() {
		const internalUser = await prisma.user.create({
			data: {
				email: "internal-user@example.com",
				passwordHash: "hashed-password",
				firstName: "Internal",
				lastName: "User",
			},
		});
		const ownerUser = await prisma.user.create({
			data: {
				email: "owner-user@example.com",
				passwordHash: "hashed-password",
				firstName: "Owner",
				lastName: "User",
			},
		});
		const activeTenant = await prisma.tenant.create({
			data: {
				name: "Active Realty",
				slug: "active-realty",
				status: TenantStatus.ACTIVE,
			},
		});
		await prisma.tenant.create({
			data: {
				name: "Suspended Realty",
				slug: "suspended-realty",
				status: TenantStatus.SUSPENDED,
			},
		});
		await prisma.tenantMembership.create({
			data: {
				userId: internalUser.id,
				tenantId: activeTenant.id,
				role: TenantRole.MANAGER,
			},
		});
		const propertyAsset = await prisma.propertyAsset.create({
			data: {
				title: "Private listing title",
				addressLine: "Secret address 123",
				city: "Buenos Aires",
				province: "Buenos Aires",
				propertyType: PropertyType.APARTMENT,
				ownerName: "Private Owner",
				ownerEmail: "owner-sensitive@example.com",
				createdByUserId: internalUser.id,
			},
		});
		await prisma.propertyAssetOwner.create({
			data: {
				propertyAssetId: propertyAsset.id,
				userId: ownerUser.id,
				ownerEmail: ownerUser.email,
				ownerFirstName: ownerUser.firstName,
				ownerLastName: ownerUser.lastName ?? "",
				isPrimary: true,
			},
		});
		const engagement = await prisma.propertyEngagement.create({
			data: {
				tenantId: activeTenant.id,
				propertyAssetId: propertyAsset.id,
				operationType: PropertyOperationType.SALE,
				status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
				createdByUserId: internalUser.id,
			},
		});
		const documentRequest = await prisma.documentRequest.create({
			data: {
				tenantId: activeTenant.id,
				propertyEngagementId: engagement.id,
				ownerUserId: ownerUser.id,
				requestedByUserId: internalUser.id,
				title: "Sensitive document request title",
				description: "Private request description",
				status: DocumentRequestStatus.PENDING,
			},
		});
		const latestAnalyticsOccurredAt = new Date(
			Date.now() - 24 * 60 * 60 * 1000,
		);
		const earlierAnalyticsOccurredAt = new Date(
			Date.now() - 2 * 24 * 60 * 60 * 1000,
		);
		const earlierEvent = await prisma.analyticsEvent.create({
			data: {
				tenantId: activeTenant.id,
				actorType: AnalyticsActorType.SYSTEM,
				eventName: AnalyticsEventName.MOVEMENT_CREATED,
				propertyEngagementId: engagement.id,
				propertyAssetId: propertyAsset.id,
				metadata: {
					email: "hidden@example.com",
					storageKey: "private/storage/key",
					safeCount: 1,
				},
				occurredAt: earlierAnalyticsOccurredAt,
			},
		});
		const latestEvent = await prisma.analyticsEvent.create({
			data: {
				tenantId: activeTenant.id,
				actorUserId: internalUser.id,
				actorType: AnalyticsActorType.INTERNAL_USER,
				eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
				propertyEngagementId: engagement.id,
				propertyAssetId: propertyAsset.id,
				documentRequestId: documentRequest.id,
				metadata: {
					ownerEmail: "owner-sensitive@example.com",
					checksum: "secret-checksum",
					readUrl: "https://private-url",
				},
				occurredAt: latestAnalyticsOccurredAt,
			},
		});

		return {
			activeTenantId: activeTenant.id,
			propertyAssetId: propertyAsset.id,
			engagementId: engagement.id,
			documentRequestId: documentRequest.id,
			earlierAnalyticsEventId: earlierEvent.id,
			earlierAnalyticsOccurredAt: earlierAnalyticsOccurredAt.toISOString(),
			latestAnalyticsEventId: latestEvent.id,
			latestAnalyticsOccurredAt: latestAnalyticsOccurredAt.toISOString(),
		};
	}

	function expectNoSensitiveFields(body: unknown) {
		const serialized = JSON.stringify(body);

		expect(serialized).not.toContain("passwordHash");
		expect(serialized).not.toContain("refreshToken");
		expect(serialized).not.toContain("storageKey");
		expect(serialized).not.toContain("readUrl");
		expect(serialized).not.toContain("checksum");
		expect(serialized).not.toContain("ownerEmail");
		expect(serialized).not.toContain("email");
		expect(serialized).not.toContain("owner-sensitive@example.com");
		expect(serialized).not.toContain("hidden@example.com");
	}
});
