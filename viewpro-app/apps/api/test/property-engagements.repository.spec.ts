import {
	MovementSource,
	MovementType,
	PropertyAssetOwnerAccessStatus,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
	Prisma,
} from "@prisma/client";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { ArchivePropertyEngagementDto } from "../src/property-engagements/dto/archive-property-engagement.dto";
import { CreatePropertyEngagementDto } from "../src/property-engagements/dto/create-property-engagement.dto";
import { ListPropertyEngagementsQuery } from "../src/property-engagements/dto/list-property-engagements.query";
import { UpdatePropertyEngagementDto } from "../src/property-engagements/dto/update-property-engagement.dto";
import { PrismaPropertyEngagementsRepository } from "../src/property-engagements/prisma-property-engagements.repository";

describe("Property engagements foundation", () => {
	it("exposes the Stage 4 property domain enums from Prisma Client", () => {
		expect(PropertyType.APARTMENT).toBe("APARTMENT");
		expect(PropertyOperationType.RENT).toBe("RENT");
		expect(PropertyEngagementStatus.CAPTURE).toBe("CAPTURE");
	});

	it("validates create DTO fields for property asset and engagement data", async () => {
		const dto = Object.assign(new CreatePropertyEngagementDto(), {
			title: "Downtown apartment",
			addressLine: "Av. Siempre Viva 123",
			city: "Buenos Aires",
			province: "CABA",
			propertyType: PropertyType.APARTMENT,
			ownerName: "Owner Example",
			ownerEmail: "owner@example.com",
			totalAreaSqm: 72,
			coveredAreaSqm: 64,
			rooms: 3,
			bedrooms: 2,
			bathrooms: 1,
			garages: 1,
			ageYears: 8,
			orientation: "NE",
			operationType: PropertyOperationType.RENT,
			publishedPriceCents: 25000000,
			currency: "ARS",
		});

		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("validates update DTO fields as optional property and engagement data", async () => {
		const dto = Object.assign(new UpdatePropertyEngagementDto(), {
			title: "Updated apartment",
			coveredAreaSqm: null,
			ownerName: null,
			operationType: PropertyOperationType.SALE,
			publishedPriceCents: 30000000,
			currency: "USD",
		});

		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("validates archive DTO with an optional short reason", async () => {
		const dto = Object.assign(new ArchivePropertyEngagementDto(), {
			reason: "Owner requested pause",
		});

		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("rejects archive DTO reasons longer than 240 characters", async () => {
		const dto = Object.assign(new ArchivePropertyEngagementDto(), {
			reason: "x".repeat(241),
		});

		const errors = await validate(dto);

		expect(errors.map((error) => error.property)).toEqual(["reason"]);
	});

	it("rejects invalid list query pagination and enum filters", async () => {
		const query = Object.assign(new ListPropertyEngagementsQuery(), {
			page: 0,
			pageSize: 51,
			status: "UNKNOWN_STATUS",
			operationType: "LEASE",
			archived: "deleted",
		});

		const errors = await validate(query);

		expect(errors.map((error) => error.property)).toEqual([
			"page",
			"pageSize",
			"status",
			"operationType",
			"archived",
		]);
	});

	it("creates a property asset and tenant-scoped engagement inside one transaction", async () => {
		const createdAsset = { id: "asset-1" };
		const createdEngagement = { id: "engagement-1", tenantId: "tenant-1" };
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAsset: { create: vi.fn().mockResolvedValue(createdAsset) },
				propertyEngagement: {
					create: vi.fn().mockResolvedValue(createdEngagement),
				},
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		const result = await repository.createWithAsset({
			tenantId: "tenant-1",
			createdByUserId: "user-1",
			propertyAsset: {
				title: "Downtown apartment",
				addressLine: "Av. Siempre Viva 123",
				city: "Buenos Aires",
				province: "CABA",
				propertyType: PropertyType.APARTMENT,
				createdBy: { connect: { id: "user-1" } },
			},
			engagement: { operationType: PropertyOperationType.RENT },
		});

		expect(transaction).toHaveBeenCalledOnce();
		expect(result).toBe(createdEngagement);
	});

	it("restricts assigned-only list queries to matching tenant assignments", async () => {
		const findMany = vi.fn().mockResolvedValue([{ id: "engagement-1" }]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaPropertyEngagementsRepository({
			propertyEngagement: { findMany, count },
		} as never);

		const result = await repository.findMany({
			tenantId: "tenant-1",
			userId: "agent-1",
			canViewAll: false,
			page: 2,
			pageSize: 10,
			status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
			operationType: PropertyOperationType.SALE,
		});

		expect(result).toEqual({ items: [{ id: "engagement-1" }], total: 1 });
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				skip: 10,
				take: 10,
				where: expect.objectContaining({
					tenantId: "tenant-1",
					status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
					operationType: PropertyOperationType.SALE,
					archivedAt: null,
					agents: { some: { agentUserId: "agent-1", tenantId: "tenant-1" } },
				}),
			}),
		);
		expect(count).toHaveBeenCalledWith({
			where: expect.objectContaining({
				tenantId: "tenant-1",
				archivedAt: null,
			}),
		});
	});

	it("lists archived tenant engagements when requested", async () => {
		const findMany = vi.fn().mockResolvedValue([{ id: "archived-engagement" }]);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaPropertyEngagementsRepository({
			propertyEngagement: { findMany, count },
		} as never);

		await expect(
			repository.findMany({
				tenantId: "tenant-1",
				userId: "manager-1",
				canViewAll: true,
				page: 1,
				pageSize: 20,
				archived: "archived",
			}),
		).resolves.toEqual({ items: [{ id: "archived-engagement" }], total: 1 });

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					tenantId: "tenant-1",
					archivedAt: { not: null },
				}),
			}),
		);
		expect(count).toHaveBeenCalledWith({
			where: expect.objectContaining({
				tenantId: "tenant-1",
				archivedAt: { not: null },
			}),
		});
	});

	it("lists all tenant engagements without an archive condition when requested", async () => {
		const findMany = vi
			.fn()
			.mockResolvedValue([
				{ id: "active-engagement" },
				{ id: "archived-engagement" },
			]);
		const count = vi.fn().mockResolvedValue(2);
		const repository = new PrismaPropertyEngagementsRepository({
			propertyEngagement: { findMany, count },
		} as never);

		await expect(
			repository.findMany({
				tenantId: "tenant-1",
				userId: "manager-1",
				canViewAll: true,
				page: 1,
				pageSize: 20,
				archived: "all",
			}),
		).resolves.toEqual({
			items: [{ id: "active-engagement" }, { id: "archived-engagement" }],
			total: 2,
		});

		const findManyWhere = findMany.mock.calls[0][0].where;
		const countWhere = count.mock.calls[0][0].where;
		expect(findManyWhere).toEqual({ tenantId: "tenant-1" });
		expect(findManyWhere).not.toHaveProperty("archivedAt");
		expect(countWhere).toEqual({ tenantId: "tenant-1" });
		expect(countWhere).not.toHaveProperty("archivedAt");
	});

	it("finds one tenant engagement without revealing unassigned records", async () => {
		const findFirst = vi.fn().mockResolvedValue({ id: "engagement-1" });
		const repository = new PrismaPropertyEngagementsRepository({
			propertyEngagement: { findFirst },
		} as never);

		await expect(
			repository.findByIdForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "agent-1",
				canViewAll: false,
			}),
		).resolves.toEqual({ id: "engagement-1" });

		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					id: "engagement-1",
					tenantId: "tenant-1",
					agents: { some: { agentUserId: "agent-1", tenantId: "tenant-1" } },
				},
			}),
		);
	});

	it("updates a tenant engagement and its property asset inside one transaction", async () => {
		const findFirst = vi
			.fn()
			.mockResolvedValue({ id: "engagement-1", propertyAssetId: "asset-1" });
		const updatePropertyAsset = vi.fn().mockResolvedValue({ id: "asset-1" });
		const updateEngagement = vi.fn().mockResolvedValue({ id: "engagement-1" });
		const findUnique = vi.fn().mockResolvedValue({ id: "engagement-1" });
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAsset: { update: updatePropertyAsset },
				propertyEngagement: { findFirst, findUnique, update: updateEngagement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.updateForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "manager-1",
				canViewAll: true,
				propertyAsset: { title: "Updated property", coveredAreaSqm: null },
				engagement: {
					operationType: PropertyOperationType.SALE,
					publishedPriceCents: 30000000,
				},
			}),
		).resolves.toEqual({ id: "engagement-1" });

		expect(transaction).toHaveBeenCalledOnce();
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: "engagement-1", tenantId: "tenant-1" },
				select: { id: true, propertyAssetId: true },
			}),
		);
		expect(updatePropertyAsset).toHaveBeenCalledWith({
			where: { id: "asset-1" },
			data: { title: "Updated property", coveredAreaSqm: null },
		});
		expect(updateEngagement).toHaveBeenCalledWith({
			where: { id: "engagement-1" },
			data: {
				operationType: PropertyOperationType.SALE,
				publishedPriceCents: 30000000,
			},
		});
	});

	it("returns null instead of updating an invisible tenant engagement", async () => {
		const updatePropertyAsset = vi.fn();
		const updateEngagement = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAsset: { update: updatePropertyAsset },
				propertyEngagement: {
					findFirst: vi.fn().mockResolvedValue(null),
					update: updateEngagement,
				},
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.updateForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "agent-1",
				canViewAll: false,
				propertyAsset: { title: "No leak" },
				engagement: {},
			}),
		).resolves.toBeNull();
		expect(updatePropertyAsset).not.toHaveBeenCalled();
		expect(updateEngagement).not.toHaveBeenCalled();
	});

	it("archives a visible active tenant engagement with archive metadata and history movement", async () => {
		const archivedEngagement = {
			id: "engagement-1",
			archivedAt: new Date("2026-01-05T00:00:00.000Z"),
			archivedByUserId: "manager-1",
			archiveReason: "Owner requested pause",
		};
		const findFirst = vi.fn().mockResolvedValue({
			id: "engagement-1",
			archivedAt: null,
		});
		const updateMany = vi.fn().mockResolvedValue({ count: 1 });
		const findUniqueOrThrow = vi.fn().mockResolvedValue(archivedEngagement);
		const createMovement = vi.fn().mockResolvedValue({ id: "movement-1" });
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: { findFirst, updateMany, findUniqueOrThrow },
				movement: { create: createMovement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.archiveForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "agent-1",
				canViewAll: false,
				archivedByUserId: "manager-1",
				archiveReason: "Owner requested pause",
			}),
		).resolves.toEqual({ status: "archived", engagement: archivedEngagement });

		expect(transaction).toHaveBeenCalledOnce();
		expect(findFirst).toHaveBeenCalledWith({
			where: {
				id: "engagement-1",
				tenantId: "tenant-1",
				agents: { some: { agentUserId: "agent-1", tenantId: "tenant-1" } },
			},
			select: { id: true, archivedAt: true },
		});
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "engagement-1", archivedAt: null },
			data: {
				archivedAt: expect.any(Date),
				archivedByUserId: "manager-1",
				archiveReason: "Owner requested pause",
			},
		});
		expect(createMovement).toHaveBeenCalledOnce();
		expect(createMovement).toHaveBeenCalledWith({
			data: {
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				createdByUserId: "manager-1",
				type: MovementType.ARCHIVED,
				observation: "Owner requested pause",
				source: MovementSource.MANUAL,
			},
		});
		expect(findUniqueOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "engagement-1" } }),
		);
	});

	it("returns alreadyArchived instead of archiving an already archived engagement", async () => {
		const updateMany = vi.fn();
		const createMovement = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: {
					findFirst: vi.fn().mockResolvedValue({
						id: "engagement-1",
						archivedAt: new Date("2026-01-05T00:00:00.000Z"),
					}),
					updateMany,
				},
				movement: { create: createMovement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.archiveForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "manager-1",
				canViewAll: true,
				archivedByUserId: "manager-1",
			}),
		).resolves.toEqual({ status: "alreadyArchived" });
		expect(updateMany).not.toHaveBeenCalled();
		expect(createMovement).not.toHaveBeenCalled();
	});

	it("returns null instead of archiving an invisible tenant engagement", async () => {
		const updateMany = vi.fn();
		const createMovement = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: {
					findFirst: vi.fn().mockResolvedValue(null),
					updateMany,
				},
				movement: { create: createMovement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.archiveForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "agent-1",
				canViewAll: false,
				archivedByUserId: "manager-1",
			}),
		).resolves.toBeNull();
		expect(updateMany).not.toHaveBeenCalled();
		expect(createMovement).not.toHaveBeenCalled();
	});

	it("restores a visible archived tenant engagement by clearing archive metadata and writing history", async () => {
		const restoredEngagement = {
			id: "engagement-1",
			archivedAt: null,
			archivedByUserId: null,
			archiveReason: null,
		};
		const findFirst = vi.fn().mockResolvedValue({
			id: "engagement-1",
			archivedAt: new Date("2026-01-05T00:00:00.000Z"),
			status: PropertyEngagementStatus.CAPTURE,
		});
		const updateMany = vi.fn().mockResolvedValue({ count: 1 });
		const findUniqueOrThrow = vi.fn().mockResolvedValue(restoredEngagement);
		const createMovement = vi.fn().mockResolvedValue({ id: "movement-1" });
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: { findFirst, updateMany, findUniqueOrThrow },
				movement: { create: createMovement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.restoreForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "manager-1",
				canViewAll: true,
			}),
		).resolves.toEqual({ status: "restored", engagement: restoredEngagement });

		expect(transaction).toHaveBeenCalledOnce();
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "engagement-1", tenantId: "tenant-1" },
			select: { id: true, archivedAt: true, status: true },
		});
		expect(updateMany).toHaveBeenCalledWith({
			where: { id: "engagement-1", archivedAt: { not: null } },
			data: {
				archivedAt: null,
				archivedByUserId: null,
				archiveReason: null,
			},
		});
		expect(createMovement).toHaveBeenCalledOnce();
		expect(createMovement).toHaveBeenCalledWith({
			data: {
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				createdByUserId: "manager-1",
				type: MovementType.RESTORED,
				observation: "Property restored",
				source: MovementSource.MANUAL,
			},
		});
		expect(findUniqueOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({ where: { id: "engagement-1" } }),
		);
	});

	it("returns notArchived instead of restoring an active engagement", async () => {
		const updateMany = vi.fn();
		const createMovement = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: {
					findFirst: vi.fn().mockResolvedValue({
						id: "engagement-1",
						archivedAt: null,
					}),
					updateMany,
				},
				movement: { create: createMovement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.restoreForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "manager-1",
				canViewAll: true,
			}),
		).resolves.toEqual({ status: "notArchived" });
		expect(updateMany).not.toHaveBeenCalled();
		expect(createMovement).not.toHaveBeenCalled();
	});

	it("returns null instead of restoring an invisible tenant engagement", async () => {
		const updateMany = vi.fn();
		const createMovement = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: {
					findFirst: vi.fn().mockResolvedValue(null),
					updateMany,
				},
				movement: { create: createMovement },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.restoreForTenant({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				userId: "agent-1",
				canViewAll: false,
			}),
		).resolves.toBeNull();
		expect(updateMany).not.toHaveBeenCalled();
		expect(createMovement).not.toHaveBeenCalled();
	});

	it("counts property images for upload limits", async () => {
		const count = vi.fn().mockResolvedValue(5);
		const repository = new PrismaPropertyEngagementsRepository({
			propertyAssetImage: { count },
		} as never);

		await expect(repository.countImagesForAsset("asset-1")).resolves.toBe(5);
		expect(count).toHaveBeenCalledWith({
			where: { propertyAssetId: "asset-1" },
		});
	});

	it("sets one property image as primary inside one transaction", async () => {
		const image = {
			id: "image-1",
			propertyAssetId: "asset-1",
			isPrimary: false,
		};
		const updatedImage = { ...image, isPrimary: true };
		const findFirst = vi.fn().mockResolvedValue(image);
		const updateMany = vi.fn().mockResolvedValue({ count: 2 });
		const update = vi.fn().mockResolvedValue(updatedImage);
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAssetImage: { findFirst, updateMany, update },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.setImageAsPrimary({
				propertyAssetId: "asset-1",
				imageId: "image-1",
			}),
		).resolves.toBe(updatedImage);

		expect(transaction).toHaveBeenCalledOnce();
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "image-1", propertyAssetId: "asset-1" },
		});
		expect(updateMany).toHaveBeenCalledWith({
			where: { propertyAssetId: "asset-1" },
			data: { isPrimary: false },
		});
		expect(update).toHaveBeenCalledWith({
			where: { id: "image-1" },
			data: { isPrimary: true },
		});
	});

	it("returns null when setting a primary image that is not part of the asset", async () => {
		const updateMany = vi.fn();
		const update = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAssetImage: {
					findFirst: vi.fn().mockResolvedValue(null),
					updateMany,
					update,
				},
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.setImageAsPrimary({
				propertyAssetId: "asset-1",
				imageId: "missing-image",
			}),
		).resolves.toBeNull();
		expect(updateMany).not.toHaveBeenCalled();
		expect(update).not.toHaveBeenCalled();
	});

	it("assigns an agent within the engagement tenant boundary", async () => {
		const createMany = vi.fn().mockResolvedValue({ count: 1 });
		const findFirstOrThrow = vi
			.fn()
			.mockResolvedValue({ id: "agent-assignment-1" });
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAgent: { createMany, findFirstOrThrow },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.assignAgent({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				agentUserId: "agent-1",
				assignedByUserId: "manager-1",
			}),
		).resolves.toEqual({
			status: "assigned",
			assignment: { id: "agent-assignment-1" },
		});

		expect(createMany).toHaveBeenCalledWith({
			data: {
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				agentUserId: "agent-1",
				assignedByUserId: "manager-1",
			},
			skipDuplicates: true,
		});
		expect(findFirstOrThrow).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				agentUserId: "agent-1",
			},
		});
	});

	it("returns already assigned when duplicate assignment is skipped", async () => {
		const createMany = vi.fn().mockResolvedValue({ count: 0 });
		const findFirstOrThrow = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAgent: { createMany, findFirstOrThrow },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.assignAgent({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				agentUserId: "agent-1",
				assignedByUserId: "manager-1",
			}),
		).resolves.toEqual({ status: "alreadyAssigned" });
		expect(findFirstOrThrow).not.toHaveBeenCalled();
	});

	it("removes an agent assignment within the engagement tenant boundary", async () => {
		const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
		const $transaction = vi.fn((callback) =>
			callback({ $queryRaw: vi.fn().mockResolvedValue([{ id: "engagement-1" }]), propertyAgent: { deleteMany } }),
		);
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);

		await expect(
			repository.removeAgent({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				agentId: "agent-assignment-1",
			}),
		).resolves.toBe(true);
		expect(deleteMany).toHaveBeenCalledWith({
			where: {
				id: "agent-assignment-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
			},
		});
	});

	it("returns false when removing an unrelated agent assignment", async () => {
		const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
		const $transaction = vi.fn((callback) =>
			callback({ $queryRaw: vi.fn().mockResolvedValue([{ id: "engagement-1" }]), propertyAgent: { deleteMany } }),
		);
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);

		await expect(
			repository.removeAgent({
				tenantId: "tenant-1",
				engagementId: "engagement-1",
				agentId: "other-assignment",
			}),
		).resolves.toBe(false);
	});

	it("links the first active owner as primary", async () => {
		const linkedOwner = {
			id: "owner-link-1",
			propertyAssetId: "asset-1",
			userId: "owner-user-1",
			ownerEmail: "owner@example.com",
			ownerFirstName: "Owner",
			ownerLastName: "Snapshot",
			isPrimary: true,
			accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
			createdAt: new Date("2026-01-05T00:00:00.000Z"),
			updatedAt: new Date("2026-01-05T00:00:00.000Z"),
			user: {
				id: "owner-user-1",
				email: "owner@example.com",
				firstName: "Owner",
				lastName: "User",
			},
		};
		const count = vi.fn().mockResolvedValue(0);
		const createMany = vi.fn().mockResolvedValue({ count: 1 });
		const findFirstOrThrow = vi.fn().mockResolvedValue(linkedOwner);
		const createInvitation = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAssetOwner: { count, createMany, findFirstOrThrow },
				ownerInvitation: { create: createInvitation },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.linkOwner({
				propertyAssetId: "asset-1",
				ownerUserId: "owner-user-1",
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Snapshot",
			}),
		).resolves.toEqual({ status: "linked", owner: linkedOwner });
		expect(count).toHaveBeenCalledWith({
			where: {
				propertyAssetId: "asset-1",
				isPrimary: true,
				accessStatus: {
					in: [
						PropertyAssetOwnerAccessStatus.INVITED,
						PropertyAssetOwnerAccessStatus.ACTIVE,
					],
				},
			},
		});
		expect(createMany).toHaveBeenCalledWith({
			data: {
				propertyAssetId: "asset-1",
				userId: "owner-user-1",
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Snapshot",
				accessStatus: PropertyAssetOwnerAccessStatus.ACTIVE,
				isPrimary: true,
			},
			skipDuplicates: true,
		});
		expect(findFirstOrThrow).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					propertyAssetId: "asset-1",
					ownerEmail: "owner@example.com",
				},
			}),
		);
		expect(createInvitation).not.toHaveBeenCalled();
	});

	it("links invited owners as non-primary and creates a pending invitation", async () => {
		const createMany = vi.fn().mockResolvedValue({ count: 1 });
		const createInvitation = vi
			.fn()
			.mockResolvedValue({ id: "owner-invitation-1" });
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAssetOwner: {
					count: vi.fn().mockResolvedValue(1),
					createMany,
					findFirstOrThrow: vi.fn().mockResolvedValue({ id: "owner-link-2" }),
				},
				ownerInvitation: { create: createInvitation },
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await repository.linkOwner({
			propertyAssetId: "asset-1",
			ownerUserId: null,
			ownerEmail: "owner-two@example.com",
			ownerFirstName: "Owner",
			ownerLastName: "Two",
		});

		expect(createMany).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					accessStatus: PropertyAssetOwnerAccessStatus.INVITED,
					isPrimary: false,
					userId: null,
				}),
			}),
		);
		expect(createInvitation).toHaveBeenCalledWith({
			data: {
				propertyAssetOwnerId: "owner-link-2",
				email: "owner-two@example.com",
				tokenHash: expect.any(String),
				expiresAt: expect.any(Date),
			},
		});
	});

	it("returns already linked when duplicate owner email is skipped", async () => {
		const findFirstOrThrow = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyAssetOwner: {
					count: vi.fn().mockResolvedValue(0),
					createMany: vi.fn().mockResolvedValue({ count: 0 }),
					findFirstOrThrow,
				},
			}),
		);
		const repository = new PrismaPropertyEngagementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.linkOwner({
				propertyAssetId: "asset-1",
				ownerUserId: "owner-user-1",
				ownerEmail: "owner@example.com",
				ownerFirstName: "Owner",
				ownerLastName: "Snapshot",
			}),
		).resolves.toEqual({ status: "alreadyLinked" });
		expect(findFirstOrThrow).not.toHaveBeenCalled();
	});
});

describe("primary seller repository mutations", () => {
	const constraint = "property_agents_one_primary_per_engagement";
	const input = {
		tenantId: "tenant-1",
		engagementId: "engagement-1",
		agentId: "assignment-2",
		expectedPrimaryAgentId: null as string | null,
	};
	const p2002 = (meta: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "6.19.2", meta });

	function primaryTransaction({
		engagement = [{ id: "engagement-1" }],
		primary = null as { id: string } | null,
		lockResults = [
			engagement,
			[{ agentUserId: "agent-user-2" }],
			[{ id: "agent-user-2" }],
			[{ id: "membership-2" }],
		],
		result = { id: "engagement-1" },
	}: Partial<{
		engagement: { id: string }[];
		primary: { id: string } | null;
		lockResults: object[][];
		result: { id: string };
	}> = {}) {
		const $queryRaw = vi.fn(() => Promise.resolve(lockResults.shift()));
		const findFirst = vi.fn().mockResolvedValue(primary);
		const updateMany = vi.fn().mockResolvedValue({ count: 1 });
		const update = vi.fn().mockResolvedValue({ id: "assignment-2", isPrimary: true });
		const findFirstOrThrow = vi.fn().mockResolvedValue(result);
		const $transaction = vi.fn((callback) =>
			callback({
				$queryRaw,
				propertyAgent: { findFirst, updateMany, update },
				propertyEngagement: { findFirstOrThrow },
			}),
		);
		return { $transaction, $queryRaw, findFirst, updateMany, update, findFirstOrThrow };
	}

	it("sets an eligible candidate from the observed no-primary state inside an engagement transaction", async () => {
		const tx = primaryTransaction();
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.setPrimaryAgent(input)).resolves.toEqual({
			status: "updated",
			engagement: { id: "engagement-1" },
		});
		expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
		expect(tx.findFirst).toHaveBeenCalledWith({
			where: { tenantId: "tenant-1", propertyEngagementId: "engagement-1", isPrimary: true },
			select: { id: true },
		});
		expect(tx.updateMany).toHaveBeenCalledWith({
			where: { tenantId: "tenant-1", propertyEngagementId: "engagement-1", isPrimary: true },
			data: { isPrimary: false },
		});
		expect(tx.update).toHaveBeenCalledWith({ where: { id: "assignment-2" }, data: { isPrimary: true } });
	});

	it.each([
		["missing assignment", [[], [], []], 2], ["stale assignment", [[], [], []], 2], ["cross-tenant assignment", [[], [], []], 2],
		["inactive user", [[{ agentUserId: "agent-user-2" }], [], []], 3],
		["inactive membership", [[{ agentUserId: "agent-user-2" }], [{ id: "agent-user-2" }], []], 4],
		["non-AGENT membership", [[{ agentUserId: "agent-user-2" }], [{ id: "agent-user-2" }], []], 4],
	])("stops %s at its eligibility lock without primary writes", async (_label, results, calls) => {
		const tx = primaryTransaction({ lockResults: [[{ id: "engagement-1" }], ...results] });
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.setPrimaryAgent(input)).resolves.toEqual({ status: "candidateInvalid" });
		expect(tx.$queryRaw).toHaveBeenCalledTimes(calls);
		expect(tx.updateMany).not.toHaveBeenCalled();
		expect(tx.update).not.toHaveBeenCalled();
	});

	it("returns stateConflict without candidate or flag writes for a stale observed primary", async () => {
		const tx = primaryTransaction({ primary: { id: "assignment-1" } });
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.setPrimaryAgent(input)).resolves.toEqual({ status: "stateConflict" });
		expect(tx.findFirst).toHaveBeenCalledOnce();
		expect(tx.updateMany).not.toHaveBeenCalled();
	});

	it("returns engagementNotFound when the tenant-scoped serialization seam finds no engagement", async () => {
		const tx = primaryTransaction({ engagement: [] });
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.setPrimaryAgent(input)).resolves.toEqual({ status: "engagementNotFound" });
		expect(tx.findFirst).not.toHaveBeenCalled();
		expect(tx.updateMany).not.toHaveBeenCalled();
	});

	it("replaces an observed primary with an eligible candidate by clearing before setting", async () => {
		const tx = primaryTransaction({ primary: { id: "assignment-1" } });
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.setPrimaryAgent({ ...input, expectedPrimaryAgentId: "assignment-1" })).resolves.toEqual({
			status: "updated", engagement: { id: "engagement-1" },
		});
		expect(tx.updateMany).toHaveBeenCalledBefore(tx.update);
	});

	it("accepts an eligible idempotent set only after validating the current primary", async () => {
		const tx = primaryTransaction({ primary: { id: "assignment-2" } });
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.setPrimaryAgent({ ...input, expectedPrimaryAgentId: "assignment-2" })).resolves.toEqual({
			status: "updated", engagement: { id: "engagement-1" },
		});
		expect(tx.findFirst).toHaveBeenCalledOnce();
		expect(tx.updateMany).not.toHaveBeenCalled();
		expect(tx.update).not.toHaveBeenCalled();
	});

	it("clears an observed primary and returns the transaction-confirmed engagement", async () => {
		const tx = primaryTransaction({ primary: { id: "assignment-1" } });
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: tx.$transaction } as never);

		await expect(repository.clearPrimaryAgent({ ...input, expectedPrimaryAgentId: "assignment-1" })).resolves.toEqual({
			status: "updated", engagement: { id: "engagement-1" },
		});
		expect(tx.updateMany).toHaveBeenCalledWith({
			where: { tenantId: "tenant-1", propertyEngagementId: "engagement-1", isPrimary: true }, data: { isPrimary: false },
		});
	});

	it("treats a null clear as idempotent and rejects a stale clear without writes", async () => {
		const idempotent = primaryTransaction();
		const repository = new PrismaPropertyEngagementsRepository({ $transaction: idempotent.$transaction } as never);
		await expect(repository.clearPrimaryAgent(input)).resolves.toEqual({ status: "updated", engagement: { id: "engagement-1" } });

		const stale = primaryTransaction({ primary: { id: "assignment-1" } });
		const staleRepository = new PrismaPropertyEngagementsRepository({ $transaction: stale.$transaction } as never);
		await expect(staleRepository.clearPrimaryAgent(input)).resolves.toEqual({ status: "stateConflict" });
		expect(stale.updateMany).not.toHaveBeenCalled();
	});

	it.each([
		["primary", "assignment-1", [{ id: "assignment-2", isPrimary: false }]],
		["non-primary", "assignment-2", [{ id: "assignment-1", isPrimary: true }]],
	])("locks before deleting a %s assignment and preserves the durable remaining state", async (_kind, agentId, expectedRows) => {
		const rows = [{ id: "assignment-1", isPrimary: true }, { id: "assignment-2", isPrimary: false }];
		const calls: string[] = [];
		const $queryRaw = vi.fn(() => { calls.push("lock"); return [{ id: "engagement-1" }]; });
		const deleteMany = vi.fn(({ where }) => {
			calls.push("delete");
			expect(calls).toEqual(["lock", "delete"]);
			const index = rows.findIndex((row) => row.id === where.id);
			return Promise.resolve({ count: index < 0 ? 0 : (rows.splice(index, 1), 1) });
		});
		const $transaction = vi.fn((callback) => callback({ $queryRaw, propertyAgent: { deleteMany } }));
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);

		await expect(repository.removeAgent({ tenantId: "tenant-1", engagementId: "engagement-1", agentId })).resolves.toBe(true);
		expect(rows).toEqual(expectedRows);
		expect(deleteMany).toHaveBeenCalledWith({ where: { id: agentId, tenantId: "tenant-1", propertyEngagementId: "engagement-1" } });
	});

	it("cannot start its scoped delete while the engagement lock is unresolved", async () => {
		let releaseLock!: () => void;
		const lock = new Promise<void>((resolve) => { releaseLock = resolve; });
		const $queryRaw = vi.fn(async () => { await lock; return [{ id: "engagement-1" }]; });
		const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
		const $transaction = vi.fn((callback) => callback({ $queryRaw, propertyAgent: { deleteMany } }));
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);
		const removal = repository.removeAgent({ tenantId: "tenant-1", engagementId: "engagement-1", agentId: "assignment-1" });

		await Promise.resolve();
		expect($queryRaw).toHaveBeenCalledOnce();
		expect(deleteMany).not.toHaveBeenCalled();
		releaseLock();
		await expect(removal).resolves.toBe(true);
	});

	it("returns false without deleting when serialized removal cannot find the engagement or assignment", async () => {
		const missingEngagement = vi.fn().mockResolvedValue([]);
		const deleteMany = vi.fn();
		const $transaction = vi.fn((callback) => callback({ $queryRaw: missingEngagement, propertyAgent: { deleteMany } }));
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);
		await expect(repository.removeAgent({ tenantId: "tenant-1", engagementId: "engagement-1", agentId: "missing" })).resolves.toBe(false);
		expect(deleteMany).not.toHaveBeenCalled();
	});

	it.each([["constraint", { constraint }], ["target", { target: [constraint] }]])("locks the exact eligible candidate rows in a fixed order and maps the named P2002 %s", async (_shape, meta) => {
		const queryResults = [
			[{ id: "engagement-1" }],
			[{ agentUserId: "agent-user-2" }],
			[{ id: "agent-user-2" }],
			[{ id: "membership-2" }],
		];
		const $queryRaw = vi.fn(() => Promise.resolve(queryResults.shift()));
		const update = vi.fn().mockRejectedValue(p2002(meta));
		const $transaction = vi.fn((callback) => callback({
			$queryRaw,
			propertyAgent: {
				findFirst: vi.fn().mockResolvedValue(null),
				updateMany: vi.fn().mockResolvedValue({ count: 0 }),
				update,
			},
			propertyEngagement: { findFirstOrThrow: vi.fn() },
		}));
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);

		await expect(repository.setPrimaryAgent(input)).resolves.toEqual({ status: "stateConflict" });
		expect($queryRaw.mock.calls.map(([query]) => Array.from(query as TemplateStringsArray).join("?"))).toEqual([
			expect.stringContaining("property_engagements\n        WHERE id = ? AND \"tenantId\" = ?\n        FOR UPDATE"),
			expect.stringContaining("property_agents\n        WHERE id = ? AND \"propertyEngagementId\" = ? AND \"tenantId\" = ?\n        FOR NO KEY UPDATE"),
			expect.stringContaining("users\n        WHERE id = ? AND status = ?::\"UserStatus\"\n        FOR NO KEY UPDATE"),
			expect.stringContaining("tenant_memberships\n        WHERE \"userId\" = ? AND \"tenantId\" = ? AND status = ?::\"TenantMembershipStatus\" AND role = ?::\"TenantRole\"\n        FOR NO KEY UPDATE"),
		]);
	});

	it.each([["P2025", { code: "P2025" }], ["another P2002 constraint", p2002({ constraint: "another_constraint" })], ["missing P2002 constraint", p2002({})]])("does not translate %s into a state conflict", async (_label, error) => {
		const $transaction = vi.fn().mockRejectedValue(error);
		const repository = new PrismaPropertyEngagementsRepository({ $transaction } as never);

		await expect(repository.setPrimaryAgent(input)).rejects.toMatchObject(error);
	});
});
