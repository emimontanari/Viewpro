import { ForbiddenException } from "@nestjs/common";
import {
	InterestLevel,
	MovementSource,
	MovementType,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	TenantRole,
	TenantStatus,
	UserStatus,
} from "@prisma/client";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { GetDashboardSummaryQuery } from "../src/analytics/dto/get-dashboard-summary.query";
import { ListActivityFeedQuery } from "../src/analytics/dto/list-activity-feed.query";
import { GetDashboardSummaryUseCase } from "../src/analytics/use-cases/get-dashboard-summary.use-case";
import { ListActivityFeedUseCase } from "../src/analytics/use-cases/list-activity-feed.use-case";
import { PERMISSIONS } from "../src/permissions/permissions.constants";
import type { TenantContext } from "../src/tenant-context/tenant-context.types";
import { BUSINESS_TIMEZONE } from "../src/common/date/business-tz";

const managerTenant: TenantContext = {
	tenantId: "tenant-1",
	tenantSlug: "tenant-one",
	tenantStatus: TenantStatus.ACTIVE,
	membershipId: "membership-1",
	role: TenantRole.MANAGER,
	permissions: [PERMISSIONS.TENANT_VIEW, PERMISSIONS.ENGAGEMENTS_VIEW_ALL],
	userStatus: UserStatus.ACTIVE,
};

const assignedAgentTenant: TenantContext = {
	...managerTenant,
	membershipId: "membership-agent-1",
	role: TenantRole.AGENT,
	permissions: [PERMISSIONS.TENANT_VIEW, PERMISSIONS.ENGAGEMENTS_VIEW_ASSIGNED],
};

const currentUser = { id: "user-1", email: "user@example.com" };

const activityMovement = {
	id: "movement-1",
	tenantId: "tenant-1",
	propertyEngagementId: "engagement-1",
	createdByUserId: "seller-1",
	type: MovementType.INQUIRY,
	observation: "Buyer asked for a Saturday visit.",
	nextStep: "Schedule visit",
	previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
	newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
	source: MovementSource.MANUAL,
	interestCount: 1,
	visitCount: 0,
	offerAmountCents: null,
	interestLevel: InterestLevel.HIGH,
	createdAt: new Date("2026-05-22T10:00:00.000Z"),
	createdBy: {
		id: "seller-1",
		email: "seller@example.com",
		firstName: "Seller",
	},
	propertyEngagement: {
		id: "engagement-1",
		tenantId: "tenant-1",
		propertyAssetId: "asset-1",
		operationType: PropertyOperationType.SALE,
		status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		publishedPriceCents: 10000000,
		currency: "ARS",
		createdByUserId: "manager-1",
		archivedAt: null,
		archivedByUserId: null,
		archiveReason: null,
		createdAt: new Date("2026-05-20T00:00:00.000Z"),
		updatedAt: new Date("2026-05-22T10:00:00.000Z"),
		propertyAsset: {
			id: "asset-1",
			title: "Casa Palermo",
			addressLine: "Uriarte 1234",
			city: "Buenos Aires",
			province: "CABA",
			propertyType: PropertyType.HOUSE,
			totalAreaSqm: null,
			coveredAreaSqm: null,
			rooms: null,
			bedrooms: null,
			bathrooms: null,
			garages: null,
			ageYears: null,
			orientation: null,
			ownerName: null,
			ownerEmail: null,
			createdByUserId: "manager-1",
			createdAt: new Date("2026-05-20T00:00:00.000Z"),
			updatedAt: new Date("2026-05-20T00:00:00.000Z"),
		},
		agents: [
			{
				id: "assignment-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				agentUserId: "seller-1",
				assignedByUserId: "manager-1",
				assignedAt: new Date("2026-05-20T00:00:00.000Z"),
				agentUser: {
					id: "seller-1",
					email: "seller@example.com",
					firstName: "Seller",
				},
			},
		],
	},
};

describe("Activity feed use case", () => {
	it("validates activity feed query filters", async () => {
		const query = Object.assign(new ListActivityFeedQuery(), {
			page: 0,
			pageSize: 51,
			type: "NOT_A_MOVEMENT",
			sellerId: "not-a-uuid",
			dateFrom: "not-a-date",
		});

		const errors = await validate(query);

		expect(errors.map((error) => error.property)).toEqual([
			"page",
			"pageSize",
			"type",
			"sellerId",
			"dateFrom",
		]);
	});

	it("returns a mapped manager activity feed with counters", async () => {
		const movementsRepository = {
			findManyByTenant: vi
				.fn()
				.mockResolvedValue({ items: [activityMovement], total: 1 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 2, staleCount: 3, attentionCount: 1 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);
		const now = new Date("2026-05-22T12:00:00.000Z");

		const result = await useCase.execute(
			managerTenant,
			currentUser,
			{
				page: 2,
				pageSize: 5,
				type: MovementType.INQUIRY,
				sellerId: "seller-1",
				// Use date-only strings (what the UI sends); the use case converts
				// them to timezone-aware UTC boundaries via the business-tz helper.
				dateFrom: "2026-05-20",
				dateTo: "2026-05-22",
			},
			now,
		);

		expect(result).toEqual({
			total: 1,
			page: 2,
			pageSize: 5,
			counters: { todayCount: 2, staleCount: 3, attentionCount: 1 },
			items: [
				expect.objectContaining({
					kind: "movement",
					id: "movement-1",
					type: MovementType.INQUIRY,
					createdAt: "2026-05-22T10:00:00.000Z",
					createdBy: {
						id: "seller-1",
						email: "seller@example.com",
						firstName: "Seller",
					},
					property: expect.objectContaining({
						id: "engagement-1",
						engagementId: "engagement-1",
						assetId: "asset-1",
						title: "Casa Palermo",
						status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
						agents: [
							{
								id: "assignment-1",
								userId: "seller-1",
								email: "seller@example.com",
								firstName: "Seller",
							},
						],
					}),
				}),
			],
		});
		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "user-1",
			canViewAll: true,
			page: 2,
			pageSize: 5,
			type: MovementType.INQUIRY,
			// sellerId is now wired to assignedAgentUserId (Bug 2 fix, FR-4/FR-6)
			assignedAgentUserId: "seller-1",
			// from = start-of-day on 2026-05-20 in Buenos Aires (UTC-3) = 03:00Z
			from: new Date("2026-05-20T03:00:00.000Z"),
			// to = exclusive end of 2026-05-22 = start of 2026-05-23 in Buenos Aires = 03:00Z
			to: new Date("2026-05-23T03:00:00.000Z"),
		});
		expect(movementsRepository.getActivityCounters).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "user-1",
			canViewAll: true,
			now,
		});
	});

	it("merges document request activity with movement activity", async () => {
		const documentRequest = {
			id: "document-request-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetOwnerId: "owner-link-1",
			ownerUserId: null,
			requestedByUserId: "seller-1",
			title: "DNI del propietario",
			description: "Frente y dorso.",
			status: "PENDING",
			reviewedByUserId: null,
			reviewedAt: null,
			rejectionReason: null,
			createdAt: new Date("2026-05-22T11:00:00.000Z"),
			updatedAt: new Date("2026-05-22T11:00:00.000Z"),
			document: null,
			propertyAssetOwner: {
				id: "owner-link-1",
				propertyAssetId: "asset-1",
				userId: null,
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Pending",
				isPrimary: true,
				accessStatus: "INVITED",
				createdAt: new Date("2026-05-22T09:00:00.000Z"),
				updatedAt: new Date("2026-05-22T09:00:00.000Z"),
			},
			propertyEngagement: activityMovement.propertyEngagement,
			requestedByUser: {
				id: "seller-1",
				email: "seller@example.com",
				firstName: "Seller",
			},
		};
		const movementsRepository = {
			findManyByTenant: vi
				.fn()
				.mockResolvedValue({ items: [activityMovement], total: 1 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 1, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi
				.fn()
				.mockResolvedValue({ items: [documentRequest], total: 1 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ page: 1, pageSize: 10, kind: "all" },
		);

		expect(result.total).toBe(2);
		expect(result.items.map((item) => item.kind)).toEqual([
			"document_request",
			"movement",
		]);
		expect(result.items[0]).toMatchObject({
			documentRequestId: "document-request-1",
			documentRequest: { title: "DNI del propietario", status: "PENDING" },
			owner: { email: "owner@example.com", ownerFirstName: "Owner" },
			requestedBy: { id: "seller-1", email: "seller@example.com" },
		});
		expect(documentsRepository.listActivityRequests).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			viewerUserId: "user-1",
			canViewAll: true,
			page: 1,
			pageSize: 10,
			// sellerId not set → assignedAgentUserId is undefined (Bug 2 fix, FR-5/FR-6)
			assignedAgentUserId: undefined,
			from: undefined,
			to: undefined,
		});
	});

	it("returns only movements when the movement kind filter is selected", async () => {
		const movementsRepository = {
			findManyByTenant: vi
				.fn()
				.mockResolvedValue({ items: [activityMovement], total: 1 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 1, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ page: 1, pageSize: 10, kind: "movement" },
		);

		expect(result.total).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			kind: "movement",
			id: "movement-1",
			type: MovementType.INQUIRY,
		});
		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "user-1",
			canViewAll: true,
			page: 1,
			pageSize: 10,
			type: undefined,
			// sellerId not set → assignedAgentUserId is undefined (Bug 2 fix, FR-4/FR-6)
			assignedAgentUserId: undefined,
			from: undefined,
			to: undefined,
		});
		expect(documentsRepository.listActivityRequests).not.toHaveBeenCalled();
	});

	it("returns only document requests when the document kind filter is selected", async () => {
		const documentRequest = {
			id: "document-request-1",
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetOwnerId: "owner-link-1",
			ownerUserId: null,
			requestedByUserId: "seller-1",
			title: "DNI del propietario",
			description: "Frente y dorso.",
			status: "PENDING",
			reviewedByUserId: null,
			reviewedAt: null,
			rejectionReason: null,
			createdAt: new Date("2026-05-22T11:00:00.000Z"),
			updatedAt: new Date("2026-05-22T11:00:00.000Z"),
			document: null,
			propertyAssetOwner: {
				id: "owner-link-1",
				propertyAssetId: "asset-1",
				userId: null,
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Pending",
				isPrimary: true,
				accessStatus: "INVITED",
				createdAt: new Date("2026-05-22T09:00:00.000Z"),
				updatedAt: new Date("2026-05-22T09:00:00.000Z"),
			},
			propertyEngagement: activityMovement.propertyEngagement,
			requestedByUser: {
				id: "seller-1",
				email: "seller@example.com",
				firstName: "Seller",
			},
		};
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 1, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi
				.fn()
				.mockResolvedValue({ items: [documentRequest], total: 1 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ page: 1, pageSize: 10, kind: "document_request" },
		);

		expect(result.total).toBe(1);
		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			kind: "document_request",
			documentRequestId: "document-request-1",
		});
		expect(movementsRepository.findManyByTenant).not.toHaveBeenCalled();
		expect(documentsRepository.listActivityRequests).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			viewerUserId: "user-1",
			canViewAll: true,
			page: 1,
			pageSize: 10,
			// sellerId not set → assignedAgentUserId is undefined (Bug 2 fix, FR-5/FR-6)
			assignedAgentUserId: undefined,
			from: undefined,
			to: undefined,
		});
	});

	it("allows assigned agents and scopes repository calls to assigned visibility", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute(
			assignedAgentTenant,
			currentUser,
			new ListActivityFeedQuery(),
		);

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: "tenant-1",
				userId: "user-1",
				canViewAll: false,
			}),
		);
		expect(movementsRepository.getActivityCounters).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: "tenant-1",
				userId: "user-1",
				canViewAll: false,
			}),
		);
	});

	it("rejects users without engagement activity visibility", async () => {
		const useCase = new ListActivityFeedUseCase({} as never, {} as never);

		await expect(
			useCase.execute(
				{ ...managerTenant, permissions: [PERMISSIONS.TENANT_VIEW] },
				currentUser,
				new ListActivityFeedQuery(),
			),
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	// S-1 (FR-1, FR-3): date-only dateFrom is parsed as start-of-day in business timezone
	it("parses date-only dateFrom as start-of-day in BUSINESS_TIMEZONE (S-1)", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute(managerTenant, currentUser, {
			dateFrom: "2026-06-15",
		});

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({
				// Buenos Aires midnight (UTC-3) = 2026-06-15T03:00:00.000Z
				from: new Date("2026-06-15T03:00:00.000Z"),
				to: undefined,
			}),
		);
		// Verify it is NOT the broken UTC midnight
		const callArgs = movementsRepository.findManyByTenant.mock.calls[0][0];
		expect(callArgs.from.toISOString()).not.toBe("2026-06-15T00:00:00.000Z");
	});

	// S-2 (FR-2, FR-3): date-only dateTo is parsed as exclusive next-day boundary
	it("parses date-only dateTo as exclusive next-day 03:00Z in BUSINESS_TIMEZONE (S-2)", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute(managerTenant, currentUser, {
			dateTo: "2026-06-15",
		});

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({
				from: undefined,
				// Exclusive end of June 15 in BA = start of June 16 = 2026-06-16T03:00:00.000Z
				to: new Date("2026-06-16T03:00:00.000Z"),
			}),
		);
	});

	// S-3 (FR-1, FR-2, FR-3): same dateFrom and dateTo produces a non-empty range (not collapsed)
	it("same-day range is non-empty: dateFrom = dateTo (S-3)", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute(managerTenant, currentUser, {
			dateFrom: "2026-06-15",
			dateTo: "2026-06-15",
		});

		const callArgs = movementsRepository.findManyByTenant.mock.calls[0][0];
		const from = callArgs.from as Date;
		const to = callArgs.to as Date;

		// Range must be non-empty: from < to
		expect(to.getTime()).toBeGreaterThan(from.getTime());
		// Correct boundaries
		expect(from).toEqual(new Date("2026-06-15T03:00:00.000Z"));
		expect(to).toEqual(new Date("2026-06-16T03:00:00.000Z"));
	});

	// S-4 (FR-4, FR-6): sellerId is wired to assignedAgentUserId on movements repo, NOT createdByUserId
	it("wires sellerId to assignedAgentUserId on movements repo (S-4)", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute(managerTenant, currentUser, { sellerId: "seller-a" });

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({ assignedAgentUserId: "seller-a" }),
		);
		expect(movementsRepository.findManyByTenant).not.toHaveBeenCalledWith(
			expect.objectContaining({ createdByUserId: "seller-a" }),
		);
	});

	// S-5 (FR-5, FR-6): sellerId is wired to assignedAgentUserId on documents repo, NOT requestedByUserId
	it("wires sellerId to assignedAgentUserId on documents repo (S-5)", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ sellerId: "seller-a" },
		);

		expect(documentsRepository.listActivityRequests).toHaveBeenCalledWith(
			expect.objectContaining({ assignedAgentUserId: "seller-a" }),
		);
		expect(documentsRepository.listActivityRequests).not.toHaveBeenCalledWith(
			expect.objectContaining({ requestedByUserId: "seller-a" }),
		);
	});

	// S-7 (FR-7, FR-8): date-only input spy records the 03:00Z boundary, not T00:00:00.000Z
	it("date-only input spy records 03:00Z from helper, not UTC midnight (S-7)", async () => {
		const movementsRepository = {
			findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		// Pass a date-only string (no T suffix) — this is what the UI sends
		await useCase.execute(managerTenant, currentUser, {
			dateFrom: "2026-06-15",
		});

		const callArgs = movementsRepository.findManyByTenant.mock.calls[0][0];
		const from = callArgs.from as Date;

		// Must be 03:00Z (Buenos Aires midnight), NOT 00:00Z (broken UTC midnight)
		expect(from.toISOString()).toBe("2026-06-15T03:00:00.000Z");
		expect(from.toISOString()).not.toBe("2026-06-15T00:00:00.000Z");
		// Explicit timezone check: the helper uses BUSINESS_TIMEZONE
		expect(BUSINESS_TIMEZONE).toBe("America/Argentina/Buenos_Aires");
	});

	// R4 verification: @IsISO8601() accepts date-only YYYY-MM-DD strings
	it("@IsISO8601 accepts date-only YYYY-MM-DD for dateFrom and dateTo (R4)", async () => {
		const query = Object.assign(new ListActivityFeedQuery(), {
			dateFrom: "2026-06-15",
			dateTo: "2026-06-15",
		});
		const errors = await validate(query);
		expect(errors.map((e) => e.property)).not.toContain("dateFrom");
		expect(errors.map((e) => e.property)).not.toContain("dateTo");
	});

	// S-12 (FR-7, FR-8): mapper produces correct documentRequest.status and currentVersion.status
	// for all 5 doc statuses. PENDING is already covered above; this it.each covers the other 4.
	it.each([
		[
			"SUBMITTED",
			"UPLOADED",
			{
				document: {
					currentVersion: {
						id: "version-submitted",
						originalFilename: "submitted.pdf",
						status: "UPLOADED",
						createdAt: new Date("2026-05-22T10:00:00.000Z"),
					},
				},
				reviewedByUserId: null,
				rejectionReason: null,
			},
		],
		[
			"APPROVED",
			"APPROVED",
			{
				document: {
					currentVersion: {
						id: "version-approved",
						originalFilename: "approved.pdf",
						status: "APPROVED",
						createdAt: new Date("2026-05-22T10:00:00.000Z"),
					},
				},
				reviewedByUserId: "reviewer-1",
				rejectionReason: null,
			},
		],
		[
			"REJECTED",
			"REJECTED",
			{
				document: {
					currentVersion: {
						id: "version-rejected",
						originalFilename: "rejected.pdf",
						status: "REJECTED",
						createdAt: new Date("2026-05-22T10:00:00.000Z"),
					},
				},
				reviewedByUserId: "reviewer-1",
				rejectionReason: "Documento ilegible",
			},
		],
		[
			"CANCELLED",
			null,
			{
				document: null,
				reviewedByUserId: null,
				rejectionReason: null,
			},
		],
	] as const)(
		"maps document_request status=%s to correct shape (S-12)",
		async (docStatus, expectedVersionStatus, overrides) => {
			const documentRequest = {
				id: "document-request-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				propertyAssetOwnerId: "owner-link-1",
				ownerUserId: null,
				requestedByUserId: "seller-1",
				title: "DNI del propietario",
				description: "Frente y dorso.",
				status: docStatus,
				reviewedAt: null,
				createdAt: new Date("2026-05-22T11:00:00.000Z"),
				updatedAt: new Date("2026-05-22T11:00:00.000Z"),
				propertyAssetOwner: {
					id: "owner-link-1",
					propertyAssetId: "asset-1",
					userId: null,
					ownerEmail: "owner@example.com",
					ownerFirstName: "Owner",
					ownerLastName: "Demo",
					isPrimary: true,
					accessStatus: "INVITED",
					createdAt: new Date("2026-05-22T09:00:00.000Z"),
					updatedAt: new Date("2026-05-22T09:00:00.000Z"),
				},
				propertyEngagement: activityMovement.propertyEngagement,
				requestedByUser: {
					id: "seller-1",
					email: "seller@example.com",
					firstName: "Seller",
				},
				...overrides,
			};

			const movementsRepository = {
				findManyByTenant: vi
					.fn()
					.mockResolvedValue({ items: [], total: 0 }),
				getActivityCounters: vi
					.fn()
					.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
			};
			const documentsRepository = {
				listActivityRequests: vi
					.fn()
					.mockResolvedValue({ items: [documentRequest], total: 1 }),
			};
			const useCase = new ListActivityFeedUseCase(
				movementsRepository as never,
				documentsRepository as never,
			);

			const result = await useCase.execute(
				{
					...managerTenant,
					permissions: [
						...managerTenant.permissions,
						PERMISSIONS.DOCUMENTS_VIEW_ALL,
					],
				},
				currentUser,
				{ page: 1, pageSize: 10, kind: "document_request" },
			);

			expect(result.items[0]).toMatchObject({
				kind: "document_request",
				documentRequest: {
					status: docStatus,
					currentVersion:
						expectedVersionStatus === null
							? null
							: expect.objectContaining({ status: expectedVersionStatus }),
				},
			});
		},
	);

	// S-13 (FR-9): mixed-kind feed sorts by createdAt desc, ties broken by id desc.
	it("mixed-kind feed sorts by createdAt desc with id tie-break (S-13)", async () => {
		const makeDocRequest = (id: string, createdAt: Date) => ({
			id,
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetOwnerId: "owner-link-1",
			ownerUserId: null,
			requestedByUserId: "seller-1",
			title: "DNI del propietario",
			description: "Frente y dorso.",
			status: "PENDING",
			reviewedByUserId: null,
			reviewedAt: null,
			rejectionReason: null,
			createdAt,
			updatedAt: createdAt,
			document: null,
			propertyAssetOwner: {
				id: "owner-link-1",
				propertyAssetId: "asset-1",
				userId: null,
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Demo",
				isPrimary: true,
				accessStatus: "INVITED",
				createdAt: new Date("2026-05-22T09:00:00.000Z"),
				updatedAt: new Date("2026-05-22T09:00:00.000Z"),
			},
			propertyEngagement: activityMovement.propertyEngagement,
			requestedByUser: {
				id: "seller-1",
				email: "seller@example.com",
				firstName: "Seller",
			},
		});

		const docEarly = makeDocRequest(
			"doc-early",
			new Date("2026-05-22T11:00:00.000Z"),
		);
		const docLate = makeDocRequest(
			"doc-late",
			new Date("2026-05-22T12:00:00.000Z"),
		);

		const movementMid = {
			...activityMovement,
			createdAt: new Date("2026-05-22T11:30:00.000Z"),
		};

		const movementsRepository = {
			findManyByTenant: vi
				.fn()
				.mockResolvedValue({ items: [movementMid], total: 1 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi
				.fn()
				.mockResolvedValue({ items: [docEarly, docLate], total: 2 }),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ page: 1, pageSize: 10, kind: "all" },
		);

		// Primary sort: createdAt desc
		expect(result.items[0].createdAt).toBe("2026-05-22T12:00:00.000Z"); // docLate
		expect(result.items[1].createdAt).toBe("2026-05-22T11:30:00.000Z"); // movementMid
		expect(result.items[2].createdAt).toBe("2026-05-22T11:00:00.000Z"); // docEarly
	});

	// S-13 tie-break: same createdAt, id desc (z-id before a-id)
	it("tie-breaks same-createdAt items by id desc (S-13 tie-break)", async () => {
		const sameTime = new Date("2026-05-22T11:00:00.000Z");

		const makeDocRequest = (id: string) => ({
			id,
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetOwnerId: "owner-link-1",
			ownerUserId: null,
			requestedByUserId: "seller-1",
			title: "DNI del propietario",
			description: "Frente y dorso.",
			status: "PENDING",
			reviewedByUserId: null,
			reviewedAt: null,
			rejectionReason: null,
			createdAt: sameTime,
			updatedAt: sameTime,
			document: null,
			propertyAssetOwner: {
				id: "owner-link-1",
				propertyAssetId: "asset-1",
				userId: null,
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Demo",
				isPrimary: true,
				accessStatus: "INVITED",
				createdAt: new Date("2026-05-22T09:00:00.000Z"),
				updatedAt: new Date("2026-05-22T09:00:00.000Z"),
			},
			propertyEngagement: activityMovement.propertyEngagement,
			requestedByUser: {
				id: "seller-1",
				email: "seller@example.com",
				firstName: "Seller",
			},
		});

		const movementsRepository = {
			findManyByTenant: vi
				.fn()
				.mockResolvedValue({ items: [], total: 0 }),
			getActivityCounters: vi
				.fn()
				.mockResolvedValue({ todayCount: 0, staleCount: 0, attentionCount: 0 }),
		};
		const documentsRepository = {
			listActivityRequests: vi
				.fn()
				.mockResolvedValue({
					items: [makeDocRequest("a-id"), makeDocRequest("z-id")],
					total: 2,
				}),
		};
		const useCase = new ListActivityFeedUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ page: 1, pageSize: 10, kind: "all" },
		);

		// The mapper prefixes id with "document-request:" — assert on the documentRequestId field
		// which carries the raw id, confirming z-id sorts before a-id (id desc tie-break).
		expect(result.items[0]).toMatchObject({ documentRequestId: "z-id" });
		expect(result.items[1]).toMatchObject({ documentRequestId: "a-id" });
	});
});

describe("Dashboard summary use case", () => {
	it("validates dashboard summary ranges", async () => {
		const query = Object.assign(new GetDashboardSummaryQuery(), {
			range: "90d",
		});

		const errors = await validate(query);

		expect(errors.map((error) => error.property)).toEqual(["range"]);
	});

	it("defaults to a rolling seven-day window and maps summary data", async () => {
		const analyticsRepository = {
			countActiveEngagements: vi.fn().mockResolvedValue(4),
			countMovementsInWindow: vi.fn().mockResolvedValue(6),
			countActiveEngagementsWithoutRecentMovement: vi.fn().mockResolvedValue(2),
			countActiveEngagementsNeedingAttention: vi.fn().mockResolvedValue(1),
			listTopPropertiesByActivity: vi.fn().mockResolvedValue([
				{
					engagementId: "engagement-1",
					propertyId: "asset-1",
					title: "Casa Palermo",
					addressLine: "Uriarte 1234",
					city: "Buenos Aires",
					province: "CABA",
					status: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
					operationType: PropertyOperationType.SALE,
					agents: [
						{
							id: "assignment-1",
							userId: "seller-1",
							email: "seller@example.com",
							firstName: "Seller",
						},
					],
					movementCount: 2,
					documentRequestCount: 1,
					lastActivityAt: new Date("2026-05-22T11:00:00.000Z"),
					lastActivityTitle: "DNI del propietario",
				},
			]),
			listTopSellersByMovement: vi.fn().mockResolvedValue([
				{
					userId: "seller-1",
					name: "Seller",
					email: "seller@example.com",
					movementCount: 2,
					touchedPropertiesCount: 1,
					lastMovementAt: new Date("2026-05-22T10:00:00.000Z"),
				},
			]),
		};
		const movementsRepository = {
			findManyByTenant: vi
				.fn()
				.mockResolvedValue({ items: [activityMovement], total: 1 }),
		};
		const documentsRepository = {
			listActivityRequests: vi.fn().mockResolvedValue({ items: [], total: 0 }),
		};
		const useCase = new GetDashboardSummaryUseCase(
			analyticsRepository as never,
			movementsRepository as never,
			documentsRepository as never,
		);
		const now = new Date("2026-05-25T12:00:00.000Z");

		const result = await useCase.execute(
			{
				...managerTenant,
				permissions: [
					...managerTenant.permissions,
					PERMISSIONS.DOCUMENTS_VIEW_ALL,
				],
			},
			currentUser,
			{ now },
		);

		expect(result).toMatchObject({
			range: {
				preset: "7d",
				from: "2026-05-18T12:00:00.000Z",
				to: "2026-05-25T12:00:00.000Z",
			},
			counters: {
				activeProperties: 4,
				movementsInRange: 6,
				staleProperties: 2,
				attentionNeeded: 1,
			},
			topProperties: [
				expect.objectContaining({
					engagementId: "engagement-1",
					movementCount: 2,
					documentRequestCount: 1,
					lastActivityAt: "2026-05-22T11:00:00.000Z",
				}),
			],
			topSellers: [
				expect.objectContaining({
					userId: "seller-1",
					movementCount: 2,
					lastMovementAt: "2026-05-22T10:00:00.000Z",
				}),
			],
		});
		expect(result.recentActivity[0]).toMatchObject({
			kind: "movement",
			id: "movement-1",
		});
		expect(analyticsRepository.countMovementsInWindow).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			from: new Date("2026-05-18T12:00:00.000Z"),
			to: now,
		});
		expect(
			analyticsRepository.countActiveEngagementsNeedingAttention,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			from: new Date("2026-05-18T12:00:00.000Z"),
			to: now,
			movementTypes: [
				MovementType.INQUIRY,
				MovementType.VISIT_COMPLETED,
				MovementType.OFFER_RECEIVED,
			],
		});
		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "user-1",
			canViewAll: true,
			page: 1,
			pageSize: 5,
			from: new Date("2026-05-18T12:00:00.000Z"),
			to: now,
		});
	});

	it("uses the selected thirty-day range", async () => {
		const analyticsRepository = {
			countActiveEngagements: vi.fn().mockResolvedValue(0),
			countMovementsInWindow: vi.fn().mockResolvedValue(0),
			countActiveEngagementsWithoutRecentMovement: vi.fn().mockResolvedValue(0),
			countActiveEngagementsNeedingAttention: vi.fn().mockResolvedValue(0),
			listTopPropertiesByActivity: vi.fn().mockResolvedValue([]),
			listTopSellersByMovement: vi.fn().mockResolvedValue([]),
		};
		const useCase = new GetDashboardSummaryUseCase(
			analyticsRepository as never,
			{
				findManyByTenant: vi.fn().mockResolvedValue({ items: [], total: 0 }),
			} as never,
			{
				listActivityRequests: vi
					.fn()
					.mockResolvedValue({ items: [], total: 0 }),
			} as never,
		);
		const now = new Date("2026-05-25T12:00:00.000Z");

		const result = await useCase.execute(managerTenant, currentUser, {
			range: "30d",
			now,
		});

		expect(result.range).toEqual({
			preset: "30d",
			from: "2026-04-25T12:00:00.000Z",
			to: "2026-05-25T12:00:00.000Z",
		});
		expect(
			analyticsRepository.listTopPropertiesByActivity,
		).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			from: new Date("2026-04-25T12:00:00.000Z"),
			to: now,
			limit: 3,
		});
	});
});
