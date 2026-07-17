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

function makeMovementAt(id: string, iso: string) {
	return { ...activityMovement, id, createdAt: new Date(iso) };
}

function makeDocumentAt(id: string, iso: string) {
	return { ...activityDocumentRequest, id, createdAt: new Date(iso) };
}

/**
 * Repository doubles that honour page/pageSize the way the real Prisma repos
 * do (newest-first slices). `items` MUST be passed newest-first.
 */
function makePaginatingRepositories(
	movementItems: unknown[],
	documentItems: unknown[],
) {
	const movementsRepository = {
		findManyByTenant: vi.fn(
			({ page, pageSize }: { page: number; pageSize: number }) => {
				const start = (page - 1) * pageSize;
				return Promise.resolve({
					items: movementItems.slice(start, start + pageSize),
					total: movementItems.length,
				});
			},
		),
	};
	const documentsRepository = {
		listActivityRequests: vi.fn(
			({ page, pageSize }: { page: number; pageSize: number }) => {
				const start = (page - 1) * pageSize;
				return Promise.resolve({
					items: documentItems.slice(start, start + pageSize),
					total: documentItems.length,
				});
			},
		),
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

	it("fetches the [0, offset+limit) window from EACH stream (page 1, pageSize = offset+limit) so the merged slice is globally ordered", async () => {
		const { movementsRepository, documentsRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		await useCase.execute({ tenantId: "tenant-1", offset: 25, limit: 10 });

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, pageSize: 35 }),
		);
		expect(documentsRepository.listActivityRequests).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, pageSize: 35 }),
		);
	});

	it("returns at most `limit` items when BOTH streams have more than `limit` (single page ≤ limit, not 2× limit)", async () => {
		const movements = [
			makeMovementAt("m-5", "2026-05-05T09:00:00.000Z"),
			makeMovementAt("m-4", "2026-05-04T09:00:00.000Z"),
			makeMovementAt("m-3", "2026-05-03T09:00:00.000Z"),
			makeMovementAt("m-2", "2026-05-02T09:00:00.000Z"),
			makeMovementAt("m-1", "2026-05-01T09:00:00.000Z"),
		];
		const documents = [
			makeDocumentAt("d-5", "2026-05-05T10:00:00.000Z"),
			makeDocumentAt("d-4", "2026-05-04T10:00:00.000Z"),
			makeDocumentAt("d-3", "2026-05-03T10:00:00.000Z"),
			makeDocumentAt("d-2", "2026-05-02T10:00:00.000Z"),
			makeDocumentAt("d-1", "2026-05-01T10:00:00.000Z"),
		];
		const { movementsRepository, documentsRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 0,
			limit: 3,
		});

		expect(result.items).toHaveLength(3);
	});

	it("orders the merged page newest-first ACROSS both streams (interleaved timestamps)", async () => {
		const movements = [
			makeMovementAt("m-13", "2026-05-01T13:00:00.000Z"),
			makeMovementAt("m-11", "2026-05-01T11:00:00.000Z"),
			makeMovementAt("m-09", "2026-05-01T09:00:00.000Z"),
		];
		const documents = [
			makeDocumentAt("d-14", "2026-05-01T14:00:00.000Z"),
			makeDocumentAt("d-12", "2026-05-01T12:00:00.000Z"),
			makeDocumentAt("d-10", "2026-05-01T10:00:00.000Z"),
		];
		const { movementsRepository, documentsRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 0,
			limit: 3,
		});

		expect(result.items.map((item) => item.createdAt)).toEqual([
			"2026-05-01T14:00:00.000Z",
			"2026-05-01T13:00:00.000Z",
			"2026-05-01T12:00:00.000Z",
		]);
	});

	it("paginates across pages with no overlap or gap (page 2 continues the global order)", async () => {
		const movements = [
			makeMovementAt("m-13", "2026-05-01T13:00:00.000Z"),
			makeMovementAt("m-11", "2026-05-01T11:00:00.000Z"),
			makeMovementAt("m-09", "2026-05-01T09:00:00.000Z"),
		];
		const documents = [
			makeDocumentAt("d-14", "2026-05-01T14:00:00.000Z"),
			makeDocumentAt("d-12", "2026-05-01T12:00:00.000Z"),
			makeDocumentAt("d-10", "2026-05-01T10:00:00.000Z"),
		];
		const { movementsRepository, documentsRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
		);

		const page1 = await useCase.execute({
			tenantId: "tenant-1",
			offset: 0,
			limit: 2,
		});
		const page2 = await useCase.execute({
			tenantId: "tenant-1",
			offset: 2,
			limit: 2,
		});

		expect(page1.items.map((item) => item.createdAt)).toEqual([
			"2026-05-01T14:00:00.000Z",
			"2026-05-01T13:00:00.000Z",
		]);
		expect(page2.items.map((item) => item.createdAt)).toEqual([
			"2026-05-01T12:00:00.000Z",
			"2026-05-01T11:00:00.000Z",
		]);

		const overlap = page1.items.some((a) =>
			page2.items.some((b) => a.id === b.id),
		);
		expect(overlap).toBe(false);
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
