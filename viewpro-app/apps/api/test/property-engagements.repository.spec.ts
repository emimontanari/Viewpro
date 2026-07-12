import {
	MovementSource,
	MovementType,
	PropertyAssetOwnerAccessStatus,
	PropertyEngagementStatus,
	PropertyOperationType,
	PropertyType,
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
		const repository = new PrismaPropertyEngagementsRepository({
			propertyAgent: { deleteMany },
		} as never);

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
		const repository = new PrismaPropertyEngagementsRepository({
			propertyAgent: { deleteMany },
		} as never);

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
