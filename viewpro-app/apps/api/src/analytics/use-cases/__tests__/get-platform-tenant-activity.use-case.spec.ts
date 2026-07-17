import {
	InterestLevel,
	MovementSource,
	MovementType,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { GetPlatformTenantActivityUseCase } from "../get-platform-tenant-activity.use-case";

/**
 * platform-tenant-tracking (PR1) — RED: GetPlatformTenantActivityUseCase
 *
 * Spec: platform-tenant-tracking — "InmoView internal tenant summary endpoint",
 *   "Trust isolation on the summary endpoint", "Per-tenant scoping"
 * Design D3: composes MovementsRepository.findManyByTenant +
 *   DocumentsRepository.listActivityRequests directly with canViewAll: true
 *   (bypasses the per-agent filter — no acting user), reuses the exported
 *   mappers + compareActivityItems sort from list-activity-feed.use-case.ts.
 */

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

const activityDocumentRequest = {
	id: "document-request-1",
	tenantId: "tenant-1",
	propertyEngagementId: "engagement-1",
	requestedByUserId: "seller-1",
	title: "DNI del propietario",
	description: "Frente y dorso.",
	status: "PENDING",
	createdAt: new Date("2026-05-23T11:00:00.000Z"),
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

function makeRepositories(overrides?: {
	movements?: Partial<{ items: unknown[]; total: number }>;
	documents?: Partial<{ items: unknown[]; total: number }>;
}) {
	const movementsRepository = {
		findManyByTenant: vi.fn().mockResolvedValue({
			items: overrides?.movements?.items ?? [activityMovement],
			total: overrides?.movements?.total ?? 1,
		}),
	};
	const documentsRepository = {
		listActivityRequests: vi.fn().mockResolvedValue({
			items: overrides?.documents?.items ?? [],
			total: overrides?.documents?.total ?? 0,
		}),
	};

	return { movementsRepository, documentsRepository };
}

describe("GetPlatformTenantActivityUseCase", () => {
	it("calls both repositories with canViewAll: true and the platform-internal sentinel userId (bypasses per-agent scoping)", async () => {
		const { movementsRepository, documentsRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute({ tenantId: "tenant-1", offset: 0, limit: 20 });

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			userId: "platform-internal",
			canViewAll: true,
			page: 1,
			pageSize: 20,
		});
		expect(documentsRepository.listActivityRequests).toHaveBeenCalledWith({
			tenantId: "tenant-1",
			viewerUserId: "platform-internal",
			canViewAll: true,
			page: 1,
			pageSize: 20,
		});

		// No per-agent scoping key present on either call.
		const movementsCallArg = movementsRepository.findManyByTenant.mock
			.calls[0]?.[0] as Record<string, unknown>;
		const documentsCallArg = documentsRepository.listActivityRequests.mock
			.calls[0]?.[0] as Record<string, unknown>;
		expect(movementsCallArg.assignedAgentUserId).toBeUndefined();
		expect(documentsCallArg.assignedAgentUserId).toBeUndefined();
	});

	it("converts offset/limit to page/pageSize (page = floor(offset/limit)+1, pageSize = limit)", async () => {
		const { movementsRepository, documentsRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute({ tenantId: "tenant-1", offset: 25, limit: 10 });

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({ page: 3, pageSize: 10 }),
		);
		expect(documentsRepository.listActivityRequests).toHaveBeenCalledWith(
			expect.objectContaining({ page: 3, pageSize: 10 }),
		);
	});

	it("merges movements + document requests, mapped and sorted via compareActivityItems (newest first)", async () => {
		const { movementsRepository, documentsRepository } = makeRepositories({
			movements: { items: [activityMovement], total: 1 },
			documents: { items: [activityDocumentRequest], total: 1 },
		});
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 0,
			limit: 20,
		});

		expect(result.total).toBe(2);
		// activityDocumentRequest.createdAt (2026-05-23) is newer than
		// activityMovement.createdAt (2026-05-22) → document request sorts first.
		expect(result.items.map((item) => item.kind)).toEqual([
			"document_request",
			"movement",
		]);
		expect(result.items[0]).toMatchObject({
			kind: "document_request",
			documentRequestId: "document-request-1",
		});
		expect(result.items[1]).toMatchObject({
			kind: "movement",
			id: "movement-1",
		});
	});

	it("defaults offset to 0 and limit to 20 when neither is provided", async () => {
		const { movementsRepository, documentsRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute({ tenantId: "tenant-1" });

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, pageSize: 20 }),
		);
	});
});
