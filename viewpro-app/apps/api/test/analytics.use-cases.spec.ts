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
import { ListActivityFeedQuery } from "../src/analytics/dto/list-activity-feed.query";
import { ListActivityFeedUseCase } from "../src/analytics/use-cases/list-activity-feed.use-case";
import { PERMISSIONS } from "../src/permissions/permissions.constants";
import type { TenantContext } from "../src/tenant-context/tenant-context.types";

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
				dateFrom: "2026-05-20T00:00:00.000Z",
				dateTo: "2026-05-22T00:00:00.000Z",
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
			createdByUserId: "seller-1",
			from: new Date("2026-05-20T00:00:00.000Z"),
			to: new Date("2026-05-22T00:00:00.000Z"),
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
			requestedByUserId: undefined,
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
			createdByUserId: undefined,
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
			requestedByUserId: undefined,
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
});
