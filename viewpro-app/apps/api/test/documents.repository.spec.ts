import { DocumentRequestStatus, DocumentVersionStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { PrismaDocumentsRepository } from "../src/documents/prisma-documents.repository";

describe("Documents repository foundation", () => {
	it("exposes document workflow enums from Prisma Client", () => {
		expect(DocumentRequestStatus.PENDING).toBe("PENDING");
		expect(DocumentRequestStatus.SUBMITTED).toBe("SUBMITTED");
		expect(DocumentVersionStatus.PENDING_UPLOAD).toBe("PENDING_UPLOAD");
		expect(DocumentVersionStatus.UPLOADED).toBe("UPLOADED");
	});

	it("creates a document request with requester and property owner link fields", async () => {
		const createdRequest = {
			id: "request-1",
			requestedByUserId: "agent-1",
			propertyAssetOwnerId: "owner-link-1",
			ownerUserId: "owner-1",
		};
		const create = vi.fn().mockResolvedValue(createdRequest);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { create },
		} as never);

		const result = await repository.createRequest({
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			propertyAssetOwnerId: "owner-link-1",
			ownerUserId: "owner-1",
			requestedByUserId: "agent-1",
			title: "Property deed",
			description: "Latest signed deed.",
		});

		expect(result).toBe(createdRequest);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tenantId: "tenant-1",
					propertyEngagementId: "engagement-1",
					propertyAssetOwnerId: "owner-link-1",
					ownerUserId: "owner-1",
					requestedByUserId: "agent-1",
					status: DocumentRequestStatus.PENDING,
				}),
			}),
		);
	});

	it("lists manager-visible requests across the tenant without requester filtering", async () => {
		const items = [
			{ id: "request-1", tenantId: "tenant-1", requestedByUserId: "agent-1" },
		];
		const findMany = vi.fn().mockResolvedValue(items);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);

		await expect(
			repository.listInternalRequests({
				tenantId: "tenant-1",
				viewerUserId: "manager-1",
				canViewAll: true,
				page: 2,
				pageSize: 10,
			}),
		).resolves.toEqual({ items, total: 1 });

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { tenantId: "tenant-1" },
				orderBy: { createdAt: "desc" },
				skip: 10,
				take: 10,
			}),
		);
		expect(count).toHaveBeenCalledWith({ where: { tenantId: "tenant-1" } });
	});

	it("lists activity requests with ordering, requester, date, and visibility filters", async () => {
		const items = [
			{ id: "request-1", tenantId: "tenant-1", requestedByUserId: "agent-1" },
		];
		const findMany = vi.fn().mockResolvedValue(items);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);

		await expect(
			repository.listActivityRequests({
				tenantId: "tenant-1",
				viewerUserId: "agent-1",
				canViewAll: false,
				page: 2,
				pageSize: 10,
				requestedByUserId: "agent-2",
				from: new Date("2026-05-20T00:00:00.000Z"),
				to: new Date("2026-05-22T00:00:00.000Z"),
			}),
		).resolves.toEqual({ items, total: 1 });

		const expectedWhere = {
			tenantId: "tenant-1",
			createdAt: {
				gte: new Date("2026-05-20T00:00:00.000Z"),
				// `lt` (exclusive end) per R2 — do NOT revert to `lte`
				lt: new Date("2026-05-22T00:00:00.000Z"),
			},
			requestedByUserId: "agent-2",
			propertyEngagement: {
				tenantId: "tenant-1",
				agents: {
					some: {
						tenantId: "tenant-1",
						agentUserId: "agent-1",
					},
				},
			},
		};
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expectedWhere,
				include: expect.any(Object),
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: 10,
				take: 10,
			}),
		);
		expect(count).toHaveBeenCalledWith({ where: expectedWhere });
	});

	// T-13 (R-D1): when assignedAgentUserId is set alongside viewer scoping (canViewAll=false),
	// the WHERE must contain two independent agents.some EXISTS clauses via AND.
	it("uses agents.some AND clause for assignedAgentUserId alongside viewer scoping (R-D1)", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const count = vi.fn().mockResolvedValue(0);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);
		const from = new Date("2026-06-15T03:00:00.000Z");
		const to = new Date("2026-06-16T03:00:00.000Z");

		await repository.listActivityRequests({
			tenantId: "tenant-1",
			viewerUserId: "manager-1",
			canViewAll: false, // triggers viewer-scoping agents.some clause
			page: 1,
			pageSize: 10,
			assignedAgentUserId: "seller-a",
			from,
			to,
		});

		const call = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
		const engagementWhere = call.where.propertyEngagement as Record<string, unknown>;

		// The AND array must contain the responsable-scoping clause
		expect(engagementWhere.AND).toEqual(
			expect.arrayContaining([
				{ agents: { some: { tenantId: "tenant-1", agentUserId: "seller-a" } } },
			]),
		);

		// The viewer-scoping agents.some must still be present on the engagement WHERE
		expect(engagementWhere.agents).toEqual({
			some: { tenantId: "tenant-1", agentUserId: "manager-1" },
		});

		// Verify lt is used (exclusive end per R2)
		const docWhere = call.where as { createdAt?: { gte?: Date; lt?: Date } };
		expect(docWhere.createdAt?.lt).toEqual(to);
		expect(docWhere.createdAt?.gte).toEqual(from);
	});

	// T-13 (R-D1, canViewAll=true): when canViewAll=true and assignedAgentUserId is set,
	// the propertyEngagement filter only contains the assignedAgentUserId clause.
	it("places assignedAgentUserId clause on propertyEngagement when canViewAll (R-D1)", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const count = vi.fn().mockResolvedValue(0);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);

		await repository.listActivityRequests({
			tenantId: "tenant-1",
			viewerUserId: "manager-1",
			canViewAll: true,
			page: 1,
			pageSize: 10,
			assignedAgentUserId: "seller-a",
		});

		const call = findMany.mock.calls[0][0] as { where: Record<string, unknown> };
		const engagementWhere = call.where.propertyEngagement as Record<string, unknown>;

		// canViewAll=true and no activeEngagementsOnly: only the assigned-agent filter
		expect(engagementWhere).toEqual({
			agents: { some: { tenantId: "tenant-1", agentUserId: "seller-a" } },
		});
	});

	it("filters internal requests by property engagement and status", async () => {
		const findMany = vi
			.fn()
			.mockResolvedValue([
				{ id: "request-1", propertyEngagementId: "engagement-1" },
			]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);

		await repository.listInternalRequests({
			tenantId: "tenant-1",
			viewerUserId: "manager-1",
			canViewAll: true,
			page: 1,
			pageSize: 20,
			propertyEngagementId: "engagement-1",
			status: DocumentRequestStatus.SUBMITTED,
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					tenantId: "tenant-1",
					propertyEngagementId: "engagement-1",
					status: DocumentRequestStatus.SUBMITTED,
				},
			}),
		);
		expect(count).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				status: DocumentRequestStatus.SUBMITTED,
			},
		});
	});

	it("lists only assigned-property requests for non-manager viewers", async () => {
		const findMany = vi
			.fn()
			.mockResolvedValue([{ id: "request-1", requestedByUserId: "agent-1" }]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);

		await repository.listInternalRequests({
			tenantId: "tenant-1",
			viewerUserId: "agent-1",
			canViewAll: false,
			page: 1,
			pageSize: 25,
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					tenantId: "tenant-1",
					propertyEngagement: {
						tenantId: "tenant-1",
						agents: {
							some: {
								tenantId: "tenant-1",
								agentUserId: "agent-1",
							},
						},
					},
				},
			}),
		);
	});

	it("combines property engagement filtering with assigned-property visibility", async () => {
		const findMany = vi
			.fn()
			.mockResolvedValue([{ id: "request-1", requestedByUserId: "agent-1" }]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findMany, count },
		} as never);

		await repository.listInternalRequests({
			tenantId: "tenant-1",
			viewerUserId: "agent-1",
			canViewAll: false,
			page: 1,
			pageSize: 25,
			propertyEngagementId: "engagement-1",
		});

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					tenantId: "tenant-1",
					propertyEngagementId: "engagement-1",
					propertyEngagement: {
						tenantId: "tenant-1",
						agents: {
							some: {
								tenantId: "tenant-1",
								agentUserId: "agent-1",
							},
						},
					},
				},
			}),
		);
	});

	it("scopes seller internal detail queries to assigned properties", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const repository = new PrismaDocumentsRepository({
			documentRequest: { findFirst },
		} as never);

		await expect(
			repository.findInternalRequestDetail({
				tenantId: "tenant-1",
				requestId: "request-1",
				viewerUserId: "agent-2",
				canViewAll: false,
			}),
		).resolves.toBeNull();

		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "request-1",
					tenantId: "tenant-1",
					propertyEngagement: {
						tenantId: "tenant-1",
						agents: {
							some: {
								tenantId: "tenant-1",
								agentUserId: "agent-2",
							},
						},
					},
				},
			}),
		);
	});

	it("creates a pending document version after checking tenant storage quota in the transaction", async () => {
		const createdDocument = {
			id: "document-1",
			documentRequestId: "request-1",
		};
		const createdVersion = {
			id: "version-1",
			storageKey: "documents/request-1/version-1.pdf",
		};
		const documentRequestFindUnique = vi
			.fn()
			.mockResolvedValue({ tenantId: "tenant-1" });
		const tenantFindUnique = vi
			.fn()
			.mockResolvedValue({ maxDocumentsStorageMb: 1 });
		const aggregate = vi
			.fn()
			.mockResolvedValue({ _sum: { sizeBytes: 1024 * 1024 - 1024 } });
		const create = vi.fn().mockResolvedValue(createdVersion);
		const transaction = vi.fn(async (callback) =>
			callback({
				$queryRaw: vi.fn(),
				documentRequest: { findUnique: documentRequestFindUnique },
				tenant: { findUnique: tenantFindUnique },
				document: { upsert: vi.fn().mockResolvedValue(createdDocument) },
				documentVersion: { aggregate, create },
			}),
		);
		const repository = new PrismaDocumentsRepository({
			$transaction: transaction,
		} as never);

		const result = await repository.createPendingVersion({
			documentRequestId: "request-1",
			uploadedByUserId: "owner-1",
			storageKey: "documents/request-1/version-1.pdf",
			originalFilename: "deed.pdf",
			mimeType: "application/pdf",
			sizeBytes: 1024,
			checksum: "sha256:abc123",
		});

		expect(result).toBe(createdVersion);
		expect(transaction).toHaveBeenCalledOnce();
		expect(documentRequestFindUnique).toHaveBeenCalledWith({
			where: { id: "request-1" },
			select: { tenantId: true },
		});
		expect(aggregate).toHaveBeenCalledWith({
			where: { document: { documentRequest: { tenantId: "tenant-1" } } },
			_sum: { sizeBytes: true },
		});
		expect(aggregate.mock.invocationCallOrder[0]).toBeLessThan(
			create.mock.invocationCallOrder[0],
		);
	});

	it("blocks pending document version creation when reserved storage would exceed the tenant limit", async () => {
		const create = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				$queryRaw: vi.fn(),
				documentRequest: {
					findUnique: vi.fn().mockResolvedValue({ tenantId: "tenant-1" }),
				},
				tenant: { findUnique: vi.fn().mockResolvedValue({ maxDocumentsStorageMb: 1 }) },
				documentVersion: {
					aggregate: vi.fn().mockResolvedValue({ _sum: { sizeBytes: 1024 * 1024 } }),
					create,
				},
				document: { upsert: vi.fn() },
			}),
		);
		const repository = new PrismaDocumentsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.createPendingVersion({
				documentRequestId: "request-1",
				uploadedByUserId: "owner-1",
				storageKey: "documents/request-1/version-1.pdf",
				originalFilename: "deed.pdf",
				mimeType: "application/pdf",
				sizeBytes: 1,
			}),
		).rejects.toThrow("Tenant document storage limit exceeded");
		expect(create).not.toHaveBeenCalled();
	});
});
