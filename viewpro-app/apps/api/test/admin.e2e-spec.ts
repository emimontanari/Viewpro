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
			limits: {
				maxUsers: null,
				maxActivePropertyEngagements: null,
				maxDocumentsStorageMb: null,
			},
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

	it("rejects unauthenticated tenant limit writes with 401", async () => {
		const response = await request(app.getHttpServer())
			.patch("/api/admin/tenants/tenant-1/limits")
			.send(createTenantLimitsPayload({ maxUsers: 10 }))
			.expect(401);

		expect(response.body.message).toBe("Authentication required");
	});

	it("rejects USER tenant limit writes with 403 even with x-tenant-id", async () => {
		const { agent, tenantId } = await registerTenantSession(
			"limits-user@example.com",
			"Limits User Homes",
		);

		const response = await agent
			.patch(`/api/admin/tenants/${tenantId}/limits`)
			.set("x-tenant-id", tenantId)
			.send(createTenantLimitsPayload({ maxUsers: 10 }))
			.expect(403);

		expect(response.body.message).toBe("ViewPro admin access required");
	});

	it("allows VIEWPRO_ADMIN to update tenant limits with an audit record", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"limits-admin@example.com",
				"Limits Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"limits-target@example.com",
			"Limits Target Homes",
		);
		const payload = createTenantLimitsPayload({
			maxUsers: 12,
			maxActivePropertyEngagements: null,
			maxDocumentsStorageMb: 2048,
		});

		const response = await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/limits`)
			.send(payload)
			.expect(200);

		expect(response.body).toEqual({
			tenantId: target.tenantId,
			previousLimits: {
				maxUsers: null,
				maxActivePropertyEngagements: null,
				maxDocumentsStorageMb: null,
			},
			limits: payload,
			unchanged: false,
			updatedAt: expect.any(String),
		});
		expectNoSensitiveFields(response.body);
		await expectTenantLimits(target.tenantId, payload);

		const auditEvents = await prisma.analyticsEvent.findMany({
			where: {
				tenantId: target.tenantId,
				eventName: AnalyticsEventName.TENANT_LIMITS_UPDATED,
			},
		});
		expect(auditEvents).toHaveLength(1);
		expect(auditEvents[0]).toMatchObject({
			tenantId: target.tenantId,
			actorUserId: adminUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.TENANT_LIMITS_UPDATED,
		});
		expect(auditEvents[0]?.metadata).toEqual({
			previousLimits: {
				maxUsers: null,
				maxActivePropertyEngagements: null,
				maxDocumentsStorageMb: null,
			},
			newLimits: payload,
		});
	});

	it("returns unchanged without creating audit when tenant limits match current limits", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"limits-idempotent-admin@example.com",
				"Limits Idempotent Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"limits-idempotent-target@example.com",
			"Limits Idempotent Target Homes",
		);
		const limits = createTenantLimitsPayload({
			maxUsers: 8,
			maxActivePropertyEngagements: 20,
			maxDocumentsStorageMb: null,
		});
		await prisma.tenant.update({
			where: { id: target.tenantId },
			data: limits,
		});

		const response = await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/limits`)
			.send(limits)
			.expect(200);

		expect(response.body).toEqual({
			tenantId: target.tenantId,
			previousLimits: limits,
			limits,
			unchanged: true,
			updatedAt: expect.any(String),
		});
		await expect(
			prisma.analyticsEvent.count({
				where: {
					tenantId: target.tenantId,
					eventName: AnalyticsEventName.TENANT_LIMITS_UPDATED,
				},
			}),
		).resolves.toBe(0);
	});

	it("rejects unsupported tenant limits with 400", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"limits-invalid-admin@example.com",
				"Limits Invalid Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"limits-invalid-target@example.com",
			"Limits Invalid Target Homes",
		);
		const invalidOverrides: Record<string, unknown>[] = [
			{ maxUsers: -1 },
			{ maxActivePropertyEngagements: -1 },
			{ maxDocumentsStorageMb: -1 },
			{ maxUsers: 1.5 },
			{ maxUsers: "10" },
			{ maxUsers: "" },
			{ maxUsers: "not-a-number" },
		];

		for (const override of invalidOverrides) {
			await adminAgent
				.patch(`/api/admin/tenants/${target.tenantId}/limits`)
				.send(createInvalidTenantLimitsPayload(override))
				.expect(400);
		}
	});

	it("returns 404 when updating unknown tenant limits", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"limits-not-found-admin@example.com",
				"Limits Not Found Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		const response = await adminAgent
			.patch("/api/admin/tenants/00000000-0000-4000-8000-000000000000/limits")
			.send(createTenantLimitsPayload({ maxUsers: 5 }))
			.expect(404);

		expect(response.body.message).toBe("Tenant not found");
	});

	it("rejects unauthenticated tenant status writes with 401", async () => {
		const response = await request(app.getHttpServer())
			.patch("/api/admin/tenants/tenant-1/status")
			.send({ status: TenantStatus.SUSPENDED })
			.expect(401);

		expect(response.body.message).toBe("Authentication required");
	});

	it("rejects USER tenant status writes with 403 even with x-tenant-id", async () => {
		const { agent, tenantId } = await registerTenantSession(
			"status-user@example.com",
			"Status User Homes",
		);

		const response = await agent
			.patch(`/api/admin/tenants/${tenantId}/status`)
			.set("x-tenant-id", tenantId)
			.send({ status: TenantStatus.SUSPENDED })
			.expect(403);

		expect(response.body.message).toBe("ViewPro admin access required");
	});

	it("allows VIEWPRO_ADMIN to suspend and reactivate a tenant with atomic audit records", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"status-admin@example.com",
				"Status Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"status-target@example.com",
			"Status Target Homes",
		);
		const auditEventName = AnalyticsEventName.TENANT_STATUS_CHANGED;

		const suspendResponse = await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/status`)
			.send({ status: TenantStatus.SUSPENDED })
			.expect(200);

		expect(suspendResponse.body).toEqual({
			tenantId: target.tenantId,
			previousStatus: TenantStatus.TRIAL,
			status: TenantStatus.SUSPENDED,
			unchanged: false,
			updatedAt: expect.any(String),
		});
		expectNoSensitiveFields(suspendResponse.body);
		await expectTenantStatus(target.tenantId, TenantStatus.SUSPENDED);
		const blockedResponse = await target.agent
			.get("/api/tenant-context/demo/view")
			.set("x-tenant-id", target.tenantId)
			.expect(403);
		expect(blockedResponse.body.message).toBe("Tenant is not active");

		const suspendAudit = await prisma.analyticsEvent.findMany({
			where: { tenantId: target.tenantId, eventName: auditEventName },
		});
		expect(suspendAudit).toHaveLength(1);
		expect(suspendAudit[0]).toMatchObject({
			tenantId: target.tenantId,
			actorUserId: adminUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: auditEventName,
		});
		expect(suspendAudit[0]?.metadata).toEqual({
			previousStatus: TenantStatus.TRIAL,
			newStatus: TenantStatus.SUSPENDED,
		});

		const reactivateResponse = await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/status`)
			.send({ status: TenantStatus.ACTIVE })
			.expect(200);

		expect(reactivateResponse.body).toEqual({
			tenantId: target.tenantId,
			previousStatus: TenantStatus.SUSPENDED,
			status: TenantStatus.ACTIVE,
			unchanged: false,
			updatedAt: expect.any(String),
		});
		await expectTenantStatus(target.tenantId, TenantStatus.ACTIVE);
		await target.agent
			.get("/api/tenant-context/demo/view")
			.set("x-tenant-id", target.tenantId)
			.expect(200);

		const auditEvents = await prisma.analyticsEvent.findMany({
			where: { tenantId: target.tenantId, eventName: auditEventName },
			orderBy: { occurredAt: "asc" },
		});
		expect(auditEvents).toHaveLength(2);
		expect(auditEvents[1]?.metadata).toEqual({
			previousStatus: TenantStatus.SUSPENDED,
			newStatus: TenantStatus.ACTIVE,
		});
	});

	it("returns unchanged without creating audit when target status matches current status", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"status-idempotent-admin@example.com",
				"Status Idempotent Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"status-idempotent-target@example.com",
			"Status Idempotent Target Homes",
		);
		await prisma.tenant.update({
			where: { id: target.tenantId },
			data: { status: TenantStatus.ACTIVE },
		});
		const auditEventName = AnalyticsEventName.TENANT_STATUS_CHANGED;

		const response = await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/status`)
			.send({ status: TenantStatus.ACTIVE })
			.expect(200);

		expect(response.body).toEqual({
			tenantId: target.tenantId,
			previousStatus: TenantStatus.ACTIVE,
			status: TenantStatus.ACTIVE,
			unchanged: true,
			updatedAt: expect.any(String),
		});
		await expectTenantStatus(target.tenantId, TenantStatus.ACTIVE);
		await expect(
			prisma.analyticsEvent.count({
				where: { tenantId: target.tenantId, eventName: auditEventName },
			}),
		).resolves.toBe(0);
	});

	it("allows VIEWPRO_ADMIN to activate a trial tenant with an audit record", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"status-activate-admin@example.com",
				"Status Activate Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"status-activate-target@example.com",
			"Status Activate Target Homes",
		);

		const response = await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/status`)
			.send({ status: TenantStatus.ACTIVE })
			.expect(200);

		expect(response.body).toEqual({
			tenantId: target.tenantId,
			previousStatus: TenantStatus.TRIAL,
			status: TenantStatus.ACTIVE,
			unchanged: false,
			updatedAt: expect.any(String),
		});
		await expectTenantStatus(target.tenantId, TenantStatus.ACTIVE);
		const auditEvents = await prisma.analyticsEvent.findMany({
			where: {
				tenantId: target.tenantId,
				eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
			},
		});
		expect(auditEvents).toHaveLength(1);
		expect(auditEvents[0]).toMatchObject({
			tenantId: target.tenantId,
			actorUserId: adminUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
		});
		expect(auditEvents[0]?.metadata).toEqual({
			previousStatus: TenantStatus.TRIAL,
			newStatus: TenantStatus.ACTIVE,
		});
	});

	it("creates one audit event when duplicate status writes race", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"status-race-admin@example.com",
				"Status Race Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			"status-race-target@example.com",
			"Status Race Target Homes",
		);

		const [firstResponse, secondResponse] = await Promise.all([
			adminAgent
				.patch(`/api/admin/tenants/${target.tenantId}/status`)
				.send({ status: TenantStatus.SUSPENDED }),
			adminAgent
				.patch(`/api/admin/tenants/${target.tenantId}/status`)
				.send({ status: TenantStatus.SUSPENDED }),
		]);

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		expect([firstResponse.body, secondResponse.body]).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					tenantId: target.tenantId,
					previousStatus: TenantStatus.TRIAL,
					status: TenantStatus.SUSPENDED,
					unchanged: false,
				}),
				expect.objectContaining({
					tenantId: target.tenantId,
					previousStatus: TenantStatus.SUSPENDED,
					status: TenantStatus.SUSPENDED,
					unchanged: true,
				}),
			]),
		);
		await expectTenantStatus(target.tenantId, TenantStatus.SUSPENDED);
		const auditEvents = await prisma.analyticsEvent.findMany({
			where: {
				tenantId: target.tenantId,
				eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
			},
		});
		expect(auditEvents).toHaveLength(1);
		expect(auditEvents[0]).toMatchObject({
			tenantId: target.tenantId,
			actorUserId: adminUserId,
			actorType: AnalyticsActorType.INTERNAL_USER,
			eventName: AnalyticsEventName.TENANT_STATUS_CHANGED,
		});
		expect(auditEvents[0]?.metadata).toEqual({
			previousStatus: TenantStatus.TRIAL,
			newStatus: TenantStatus.SUSPENDED,
		});
	});

	it.each([
		TenantStatus.TRIAL,
		TenantStatus.CANCELLED,
		"NOT_A_STATUS",
	])("rejects unsupported tenant status %s with 400", async (status) => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				`status-invalid-${status.toLowerCase()}@example.com`,
				"Status Invalid Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});
		const target = await registerTenantSession(
			`status-invalid-target-${status.toLowerCase()}@example.com`,
			`Status Invalid Target ${status}`,
		);

		await adminAgent
			.patch(`/api/admin/tenants/${target.tenantId}/status`)
			.send({ status })
			.expect(400);
	});

	it("returns 404 when updating an unknown tenant status", async () => {
		const { agent: adminAgent, userId: adminUserId } =
			await registerTenantSession(
				"status-not-found-admin@example.com",
				"Status Not Found Admin Homes",
			);
		await prisma.user.update({
			where: { id: adminUserId },
			data: { globalRole: GlobalRole.VIEWPRO_ADMIN },
		});

		const response = await adminAgent
			.patch("/api/admin/tenants/00000000-0000-4000-8000-000000000000/status")
			.send({ status: TenantStatus.SUSPENDED })
			.expect(404);

		expect(response.body.message).toBe("Tenant not found");
	});

	type TenantLimitsPayload = {
		maxUsers: number | null;
		maxActivePropertyEngagements: number | null;
		maxDocumentsStorageMb: number | null;
	};

	function createTenantLimitsPayload(
		override: Partial<TenantLimitsPayload>,
	): TenantLimitsPayload {
		return {
			maxUsers: null,
			maxActivePropertyEngagements: null,
			maxDocumentsStorageMb: null,
			...override,
		};
	}

	function createInvalidTenantLimitsPayload(
		override: Record<string, unknown>,
	): Record<string, unknown> {
		return {
			maxUsers: null,
			maxActivePropertyEngagements: null,
			maxDocumentsStorageMb: null,
			...override,
		};
	}

	async function expectTenantStatus(tenantId: string, status: TenantStatus) {
		const tenant = await prisma.tenant.findUniqueOrThrow({
			where: { id: tenantId },
		});

		expect(tenant.status).toBe(status);
	}

	async function expectTenantLimits(
		tenantId: string,
		limits: TenantLimitsPayload,
	) {
		const tenant = await prisma.tenant.findUniqueOrThrow({
			where: { id: tenantId },
		});

		expect({
			maxUsers: tenant.maxUsers,
			maxActivePropertyEngagements: tenant.maxActivePropertyEngagements,
			maxDocumentsStorageMb: tenant.maxDocumentsStorageMb,
		}).toEqual(limits);
	}

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
