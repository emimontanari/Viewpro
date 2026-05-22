import {
	InterestLevel,
	MovementSource,
	MovementType,
	PropertyEngagementStatus,
} from "@prisma/client";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import { CreateMovementDto } from "../src/movements/dto/create-movement.dto";
import { ListMovementsQuery } from "../src/movements/dto/list-movements.query";
import { PrismaMovementsRepository } from "../src/movements/prisma-movements.repository";

describe("Movements foundation", () => {
	it("exposes the Stage 5 movement enums from Prisma Client", () => {
		expect(MovementType.STATUS_CHANGE).toBe("STATUS_CHANGE");
		expect(MovementSource.MANUAL).toBe("MANUAL");
		expect(InterestLevel.HIGH).toBe("HIGH");
	});

	it("validates create movement DTO fields", async () => {
		const dto = Object.assign(new CreateMovementDto(), {
			type: MovementType.INQUIRY,
			observation: "Buyer asked for a visit.",
			nextStep: "Schedule visit",
			newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			interestCount: 2,
			visitCount: 1,
			offerAmountCents: 100_000_00,
			interestLevel: InterestLevel.HIGH,
		});

		await expect(validate(dto)).resolves.toHaveLength(0);
	});

	it("rejects invalid movement list pagination and order", async () => {
		const query = Object.assign(new ListMovementsQuery(), {
			page: 0,
			pageSize: 51,
			order: "oldest",
		});

		const errors = await validate(query);

		expect(errors.map((error) => error.property)).toEqual([
			"page",
			"pageSize",
			"order",
		]);
	});

	it("creates a movement without changing engagement status", async () => {
		const engagement = {
			id: "engagement-1",
			status: PropertyEngagementStatus.CAPTURE,
		};
		const createdMovement = {
			id: "movement-1",
			tenantId: "tenant-1",
			createdBy: { id: "user-1" },
		};
		const findFirst = vi.fn().mockResolvedValue(engagement);
		const create = vi.fn().mockResolvedValue(createdMovement);
		const update = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: { findFirst, update },
				movement: { create },
			}),
		);
		const repository = new PrismaMovementsRepository({
			$transaction: transaction,
		} as never);

		const result = await repository.create({
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
			createdByUserId: "user-1",
			type: MovementType.GENERAL_UPDATE,
			observation: "Owner sent updated photos.",
			nextStep: "Refresh listing assets",
		});

		expect(result).toBe(createdMovement);
		expect(transaction).toHaveBeenCalledOnce();
		expect(findFirst).toHaveBeenCalledWith({
			where: { id: "engagement-1", tenantId: "tenant-1" },
		});
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					tenantId: "tenant-1",
					propertyEngagementId: "engagement-1",
					createdByUserId: "user-1",
					previousStatus: null,
					newStatus: null,
				}),
			}),
		);
		expect(update).not.toHaveBeenCalled();
	});

	it("creates a movement and updates engagement status in one transaction", async () => {
		const engagement = {
			id: "engagement-1",
			status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
		};
		const createdMovement = {
			id: "movement-1",
			newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
		};
		const findFirst = vi.fn().mockResolvedValue(engagement);
		const create = vi.fn().mockResolvedValue(createdMovement);
		const update = vi.fn().mockResolvedValue({ id: "engagement-1" });
		const transaction = vi.fn(async (callback) =>
			callback({
				propertyEngagement: { findFirst, update },
				movement: { create },
			}),
		);
		const repository = new PrismaMovementsRepository({
			$transaction: transaction,
		} as never);

		await expect(
			repository.create({
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				createdByUserId: "user-1",
				type: MovementType.STATUS_CHANGE,
				observation: "First inquiry received.",
				newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
			}),
		).resolves.toBe(createdMovement);

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					previousStatus: PropertyEngagementStatus.ACTIVE_PUBLICATION,
					newStatus: PropertyEngagementStatus.INQUIRIES_AND_VISITS,
				}),
			}),
		);
		expect(update).toHaveBeenCalledWith({
			where: { id: "engagement-1" },
			data: { status: PropertyEngagementStatus.INQUIRIES_AND_VISITS },
		});
	});

	it("returns null when creating for a missing tenant engagement", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const create = vi.fn();
		const transaction = vi.fn(async (callback) =>
			callback({ propertyEngagement: { findFirst }, movement: { create } }),
		);
		const repository = new PrismaMovementsRepository({
			$transaction: transaction,
		} as never);

		const result = await repository.create({
			tenantId: "tenant-1",
			propertyEngagementId: "missing-engagement",
			createdByUserId: "user-1",
			type: MovementType.GENERAL_UPDATE,
			observation: "Should not be created.",
		});

		expect(result).toBeNull();
		expect(create).not.toHaveBeenCalled();
	});

	it("lists only movements for the requested tenant engagement", async () => {
		const items = [
			{
				id: "movement-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
			},
		];
		const findMany = vi.fn().mockResolvedValue(items);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaMovementsRepository({
			movement: { findMany, count },
		} as never);

		await expect(
			repository.findMany({
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
				page: 2,
				pageSize: 10,
				order: "asc",
			}),
		).resolves.toEqual({ items, total: 1 });

		const where = {
			tenantId: "tenant-1",
			propertyEngagementId: "engagement-1",
		};
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where,
				orderBy: { createdAt: "asc" },
				skip: 10,
				take: 10,
			}),
		);
		expect(count).toHaveBeenCalledWith({ where });
	});

	it("lists tenant activity movements using visibility, archive, and filter constraints", async () => {
		const items = [
			{
				id: "movement-1",
				tenantId: "tenant-1",
				propertyEngagementId: "engagement-1",
			},
		];
		const findMany = vi.fn().mockResolvedValue(items);
		const count = vi.fn().mockResolvedValue(1);
		const repository = new PrismaMovementsRepository({
			movement: { findMany, count },
		} as never);
		const from = new Date("2026-05-20T00:00:00.000Z");
		const to = new Date("2026-05-21T00:00:00.000Z");

		await expect(
			repository.findManyByTenant({
				tenantId: "tenant-1",
				userId: "agent-1",
				canViewAll: false,
				page: 3,
				pageSize: 5,
				type: MovementType.INQUIRY,
				createdByUserId: "seller-1",
				from,
				to,
			}),
		).resolves.toEqual({ items, total: 1 });

		const expectedEngagementWhere = {
			tenantId: "tenant-1",
			archivedAt: null,
			status: {
				notIn: [
					PropertyEngagementStatus.CLOSED,
					PropertyEngagementStatus.CANCELLED,
				],
			},
			agents: { some: { tenantId: "tenant-1", agentUserId: "agent-1" } },
		};
		const expectedWhere = {
			tenantId: "tenant-1",
			type: MovementType.INQUIRY,
			createdByUserId: "seller-1",
			createdAt: { gte: from, lte: to },
			propertyEngagement: expectedEngagementWhere,
		};

		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expectedWhere,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: 10,
				take: 5,
			}),
		);
		expect(count).toHaveBeenCalledWith({ where: expectedWhere });
	});

	it("counts activity summary for the same tenant visibility scope", async () => {
		const movementCount = vi.fn().mockResolvedValue(2);
		const propertyEngagementCount = vi.fn().mockResolvedValue(3);
		const propertyEngagementFindMany = vi
			.fn()
			.mockResolvedValue([
				{ movements: [{ type: MovementType.INQUIRY, nextStep: null }] },
				{
					movements: [
						{ type: MovementType.OFFER_RECEIVED, nextStep: "Call owner" },
					],
				},
				{ movements: [{ type: MovementType.VISIT_COMPLETED, nextStep: "" }] },
				{ movements: [{ type: MovementType.GENERAL_UPDATE, nextStep: null }] },
				{ movements: [] },
			]);
		const repository = new PrismaMovementsRepository({
			movement: { count: movementCount },
			propertyEngagement: {
				count: propertyEngagementCount,
				findMany: propertyEngagementFindMany,
			},
		} as never);
		const now = new Date("2026-05-22T12:00:00.000Z");

		await expect(
			repository.getActivityCounters({
				tenantId: "tenant-1",
				userId: "agent-1",
				canViewAll: false,
				now,
			}),
		).resolves.toEqual({ todayCount: 2, staleCount: 3, attentionCount: 2 });

		const scopedEngagementWhere = {
			tenantId: "tenant-1",
			archivedAt: null,
			status: {
				notIn: [
					PropertyEngagementStatus.CLOSED,
					PropertyEngagementStatus.CANCELLED,
				],
			},
			agents: { some: { tenantId: "tenant-1", agentUserId: "agent-1" } },
		};
		expect(movementCount).toHaveBeenCalledWith({
			where: {
				tenantId: "tenant-1",
				createdAt: {
					gte: new Date("2026-05-21T12:00:00.000Z"),
					lt: now,
				},
				propertyEngagement: scopedEngagementWhere,
			},
		});
		expect(propertyEngagementCount).toHaveBeenCalledWith({
			where: {
				...scopedEngagementWhere,
				movements: {
					none: {
						createdAt: {
							gte: new Date("2026-05-15T12:00:00.000Z"),
							lt: now,
						},
					},
				},
			},
		});
		expect(propertyEngagementFindMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: scopedEngagementWhere,
				select: expect.objectContaining({ movements: expect.any(Object) }),
			}),
		);
	});
});
