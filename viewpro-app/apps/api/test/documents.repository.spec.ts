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
				lte: new Date("2026-05-22T00:00:00.000Z"),
			},
			requestedByUserId: "agent-1",
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

	it("lists only requesting-seller-visible requests for non-manager viewers", async () => {
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
				where: { tenantId: "tenant-1", requestedByUserId: "agent-1" },
			}),
		);
	});

	it("combines property engagement filtering with requesting-seller visibility", async () => {
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
					requestedByUserId: "agent-1",
				},
			}),
		);
	});

	it("hides peer seller requests in internal detail queries", async () => {
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
					requestedByUserId: "agent-2",
				},
			}),
		);
	});

	it("creates a pending document version with storage metadata", async () => {
		const createdDocument = {
			id: "document-1",
			documentRequestId: "request-1",
		};
		const createdVersion = {
			id: "version-1",
			storageKey: "documents/request-1/version-1.pdf",
		};
		const transaction = vi.fn(async (callback) =>
			callback({
				document: { upsert: vi.fn().mockResolvedValue(createdDocument) },
				documentVersion: { create: vi.fn().mockResolvedValue(createdVersion) },
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
	});
});
