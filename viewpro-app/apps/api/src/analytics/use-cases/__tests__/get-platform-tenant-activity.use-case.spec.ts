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
	memberships?: Partial<{ items: unknown[]; total: number }>;
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
	const membershipActivityRepository = {
		findManyByTenant: vi.fn().mockResolvedValue({
			items: overrides?.memberships?.items ?? [],
			total: overrides?.memberships?.total ?? 0,
		}),
	};

	return { movementsRepository, documentsRepository, membershipActivityRepository };
}

function makeMovementAt(id: string, iso: string) {
	return { ...activityMovement, id, createdAt: new Date(iso) };
}

function makeDocumentAt(id: string, iso: string) {
	return { ...activityDocumentRequest, id, createdAt: new Date(iso) };
}

const activityMembership = {
	event: "JOINED" as const,
	id: "membership-1",
	tenantId: "tenant-1",
	createdAt: new Date("2026-05-24T10:00:00.000Z"),
	user: { id: "member-1", email: "member@example.com", firstName: "Member" },
};

function makeMembershipAt(id: string, iso: string) {
	return { ...activityMembership, id, createdAt: new Date(iso) };
}

/**
 * Repository doubles that honour page/pageSize the way the real Prisma repos
 * do (newest-first slices). `items` MUST be passed newest-first.
 * `membershipItems` defaults to an empty stream — existing (pre-3-source)
 * call sites keep passing only movements/documents.
 */
function makePaginatingRepositories(
	movementItems: unknown[],
	documentItems: unknown[],
	membershipItems: unknown[] = [],
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
	const membershipActivityRepository = {
		findManyByTenant: vi.fn(
			({ page, pageSize }: { page: number; pageSize: number }) => {
				const start = (page - 1) * pageSize;
				return Promise.resolve({
					items: membershipItems.slice(start, start + pageSize),
					total: membershipItems.length,
				});
			},
		),
	};

	return { movementsRepository, documentsRepository, membershipActivityRepository };
}

describe("GetPlatformTenantActivityUseCase", () => {
	it("calls both repositories with canViewAll: true and the platform-internal sentinel userId (bypasses per-agent scoping)", async () => {
		const { movementsRepository, documentsRepository, membershipActivityRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
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
		const { movementsRepository, documentsRepository, membershipActivityRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
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
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
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
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
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
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
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
		const { movementsRepository, documentsRepository, membershipActivityRepository } = makeRepositories({
			movements: { items: [activityMovement], total: 1 },
			documents: { items: [activityDocumentRequest], total: 1 },
		});
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
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
		const { movementsRepository, documentsRepository, membershipActivityRepository } = makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		await useCase.execute({ tenantId: "tenant-1" });

		expect(movementsRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({ page: 1, pageSize: 20 }),
		);
	});

	/**
	 * MAX_FETCH_WINDOW boundary (window = 200).
	 *
	 * Regression: the merged feed fetches at most MAX_FETCH_WINDOW rows per
	 * stream, so only the FIRST MAX_FETCH_WINDOW positions of the merged/sorted
	 * array are globally reliable. Slicing with the uncapped `offset + limit`
	 * indexed BEYOND that window and returned WRONG, unrelated items (e.g.
	 * documents substituted where un-fetched movements truly rank). The slice
	 * upper bound must never exceed the fetched window: deep pages degrade to
	 * empty/partial-correct — never wrong items — while `total` stays the true
	 * (possibly larger) combined count.
	 *
	 * Fixtures: 250 movements ALL newer than 250 documents → true global order
	 * is m-0..m-249 then d-0..d-249. Only m-0..m-199 / d-0..d-199 are fetched.
	 */
	function buildWindowBoundaryStreams() {
		const base = Date.parse("2026-06-01T00:00:00.000Z");
		const movements = Array.from({ length: 250 }, (_, i) =>
			makeMovementAt(`m-${i}`, new Date(base + (500 - i) * 60_000).toISOString()),
		);
		const documents = Array.from({ length: 250 }, (_, i) =>
			makeDocumentAt(`d-${i}`, new Date(base - (i + 1) * 60_000).toISOString()),
		);
		return { movements, documents };
	}

	it("returns a correct PARTIAL last page (never wrong items) when offset < MAX_FETCH_WINDOW < offset+limit", async () => {
		const { movements, documents } = buildWindowBoundaryStreams();
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		// window = 200; offset 190 + limit 20 straddles the fetched window.
		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 190,
			limit: 20,
		});

		// Only positions 190..199 are reliably fetched → exactly m-190..m-199.
		// The buggy slice(190, 210) appended d-0..d-9 (WRONG — true positions
		// 200..209 are the un-fetched m-200..m-209).
		expect(result.items.map((item) => item.id)).toEqual(
			movements.slice(190, 200).map((movement) => movement.id),
		);
		expect(result.items).toHaveLength(10);
		// total is the true combined count — may exceed the browsable window.
		expect(result.total).toBe(500);
	});

	it("returns an EMPTY page (never wrong items) when offset >= MAX_FETCH_WINDOW", async () => {
		const { movements, documents } = buildWindowBoundaryStreams();
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		// offset 210 is beyond the fetched window (200) → honest empty page.
		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 210,
			limit: 20,
		});

		// The buggy slice(210, 230) returned d-10..d-29 (WRONG items).
		expect(result.items).toEqual([]);
		// total still reports the full count (honest depth limit, not corruption).
		expect(result.total).toBe(500);
	});

	it("returns a correct full page when offset+limit <= MAX_FETCH_WINDOW", async () => {
		const { movements, documents } = buildWindowBoundaryStreams();
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 100,
			limit: 20,
		});

		expect(result.items.map((item) => item.id)).toEqual(
			movements.slice(100, 120).map((movement) => movement.id),
		);
		expect(result.items).toHaveLength(20);
	});

	/**
	 * platform-user-activity-capture — 3-source merge (membership joins the
	 * existing movement + document-request streams). Task 2.3: newest-first
	 * interleave across all three, `total` = sum of the three, and the
	 * MAX_FETCH_WINDOW pagination invariant (D2) generalizes to k=3 sources
	 * unmodified.
	 */
	it("calls the membership activity repository with the same page/pageSize window as the other two streams", async () => {
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makeRepositories();
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		await useCase.execute({ tenantId: "tenant-1", offset: 25, limit: 10 });

		expect(membershipActivityRepository.findManyByTenant).toHaveBeenCalledWith(
			expect.objectContaining({ tenantId: "tenant-1", page: 1, pageSize: 35 }),
		);
	});

	it("interleaves membership events newest-first WITH movements and document requests (not appended after)", async () => {
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makeRepositories({
				movements: { items: [activityMovement], total: 1 }, // 2026-05-22
				documents: { items: [activityDocumentRequest], total: 1 }, // 2026-05-23
				memberships: {
					items: [makeMembershipAt("membership-newest", "2026-05-24T10:00:00.000Z")],
					total: 1,
				},
			});
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		const result = await useCase.execute({
			tenantId: "tenant-1",
			offset: 0,
			limit: 20,
		});

		expect(result.items.map((item) => item.kind)).toEqual([
			"membership",
			"document_request",
			"movement",
		]);
	});

	it("total equals the sum of movements + document requests + membership events", async () => {
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makeRepositories({
				movements: { items: [activityMovement], total: 3 },
				documents: { items: [activityDocumentRequest], total: 2 },
				memberships: {
					items: [makeMembershipAt("membership-1", "2026-05-24T10:00:00.000Z")],
					total: 4,
				},
			});
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		const result = await useCase.execute({ tenantId: "tenant-1", offset: 0, limit: 20 });

		expect(result.total).toBe(9);
	});

	it("preserves the MAX_FETCH_WINDOW pagination invariant with three sources: returns at most `limit` items and never a wrong item past the fetched window", async () => {
		const base = Date.parse("2026-06-01T00:00:00.000Z");
		const movements = Array.from({ length: 80 }, (_, i) =>
			makeMovementAt(`m-${i}`, new Date(base + (300 - i) * 60_000).toISOString()),
		);
		const documents = Array.from({ length: 80 }, (_, i) =>
			makeDocumentAt(`d-${i}`, new Date(base - (i + 1) * 60_000).toISOString()),
		);
		const memberships = Array.from({ length: 80 }, (_, i) =>
			makeMembershipAt(`mem-${i}`, new Date(base - (200 + i) * 60_000).toISOString()),
		);
		const { movementsRepository, documentsRepository, membershipActivityRepository } =
			makePaginatingRepositories(movements, documents, memberships);
		const useCase = new GetPlatformTenantActivityUseCase(
			movementsRepository as never,
			documentsRepository as never,
			membershipActivityRepository as never,
		);

		// True global order (newest-first): all 80 movements, then all 80
		// documents, then all 80 memberships. A page fully inside the movements
		// stream must return exactly those movements, in order.
		const result = await useCase.execute({ tenantId: "tenant-1", offset: 10, limit: 20 });

		expect(result.items.map((item) => item.id)).toEqual(
			movements.slice(10, 30).map((movement) => movement.id),
		);
		expect(result.items).toHaveLength(20);
		expect(result.total).toBe(240);
	});
});
