import { Injectable } from "@nestjs/common";
import { MovementType, PropertyEngagementStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type {
	ActivityCountersInput,
	ActivityFeedCounters,
	ActivityMovementWithRelations,
	CreateMovementInput,
	ListMovementsInput,
	ListTenantMovementsInput,
	MovementsRepository,
	MovementWithRelations,
} from "./movements.repository";

const movementInclude = {
	createdBy: true,
} satisfies Prisma.MovementInclude;

const activityMovementInclude = {
	createdBy: { select: { id: true, email: true, firstName: true } },
	propertyEngagement: {
		include: {
			propertyAsset: true,
			agents: {
				include: {
					agentUser: { select: { id: true, email: true, firstName: true } },
				},
				orderBy: { assignedAt: "asc" },
			},
		},
	},
} satisfies Prisma.MovementInclude;

const inactiveEngagementStatuses = [
	PropertyEngagementStatus.CLOSED,
	PropertyEngagementStatus.CANCELLED,
];
const attentionMovementTypes = new Set<MovementType>([
	MovementType.INQUIRY,
	MovementType.VISIT_COMPLETED,
	MovementType.OFFER_RECEIVED,
]);

@Injectable()
export class PrismaMovementsRepository implements MovementsRepository {
	constructor(private readonly prisma: PrismaService) {}

	create(input: CreateMovementInput): Promise<MovementWithRelations | null> {
		return this.prisma.$transaction(async (tx) => {
			const engagement = await tx.propertyEngagement.findFirst({
				where: { id: input.propertyEngagementId, tenantId: input.tenantId },
			});

			if (!engagement) {
				return null;
			}

			const movement = await tx.movement.create({
				data: {
					tenantId: input.tenantId,
					propertyEngagementId: input.propertyEngagementId,
					createdByUserId: input.createdByUserId,
					type: input.type,
					observation: input.observation,
					nextStep: input.nextStep,
					previousStatus: input.newStatus ? engagement.status : null,
					newStatus: input.newStatus ?? null,
					interestCount: input.interestCount,
					visitCount: input.visitCount,
					offerAmountCents: input.offerAmountCents,
					interestLevel: input.interestLevel,
				},
				include: movementInclude,
			});

			if (input.newStatus) {
				await tx.propertyEngagement.update({
					where: { id: input.propertyEngagementId },
					data: { status: input.newStatus },
				});
			}

			return movement;
		});
	}

	async findMany(
		input: ListMovementsInput,
	): Promise<{ items: MovementWithRelations[]; total: number }> {
		const where = {
			tenantId: input.tenantId,
			propertyEngagementId: input.propertyEngagementId,
		} satisfies Prisma.MovementWhereInput;

		const [items, total] = await Promise.all([
			this.prisma.movement.findMany({
				where,
				include: movementInclude,
				orderBy: { createdAt: input.order },
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
			}),
			this.prisma.movement.count({ where }),
		]);

		return { items, total };
	}

	async findManyByTenant(
		input: ListTenantMovementsInput,
	): Promise<{ items: ActivityMovementWithRelations[]; total: number }> {
		const where = this.buildTenantActivityMovementWhere(input);

		const [items, total] = await Promise.all([
			this.prisma.movement.findMany({
				where,
				include: activityMovementInclude,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: (input.page - 1) * input.pageSize,
				take: input.pageSize,
			}),
			this.prisma.movement.count({ where }),
		]);

		return { items, total };
	}

	async getActivityCounters(
		input: ActivityCountersInput,
	): Promise<ActivityFeedCounters> {
		const now = input.now;
		const todayFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const staleFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
		const engagementWhere = this.buildActivityEngagementWhere(input);

		const [todayCount, staleCount, engagementLatestMovements] =
			await Promise.all([
				this.prisma.movement.count({
					where: {
						tenantId: input.tenantId,
						createdAt: { gte: todayFrom, lt: now },
						propertyEngagement: engagementWhere,
					},
				}),
				this.prisma.propertyEngagement.count({
					where: {
						...engagementWhere,
						movements: { none: { createdAt: { gte: staleFrom, lt: now } } },
					},
				}),
				this.prisma.propertyEngagement.findMany({
					where: engagementWhere,
					select: {
						movements: {
							orderBy: [{ createdAt: "desc" }, { id: "desc" }],
							take: 1,
							select: { type: true, nextStep: true },
						},
					},
				}),
			]);

		const attentionCount = engagementLatestMovements.filter((engagement) => {
			const latestMovement = engagement.movements[0];

			return (
				latestMovement &&
				attentionMovementTypes.has(latestMovement.type) &&
				!latestMovement.nextStep?.trim()
			);
		}).length;

		return { todayCount, staleCount, attentionCount };
	}

	private buildTenantActivityMovementWhere(
		input: ListTenantMovementsInput,
	): Prisma.MovementWhereInput {
		const createdAt: Prisma.DateTimeFilter = {};

		if (input.from) {
			createdAt.gte = input.from;
		}

		if (input.to) {
			createdAt.lte = input.to;
		}

		return {
			tenantId: input.tenantId,
			...(input.type ? { type: input.type } : {}),
			...(input.createdByUserId
				? { createdByUserId: input.createdByUserId }
				: {}),
			...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
			propertyEngagement: this.buildActivityEngagementWhere(input),
		};
	}

	private buildActivityEngagementWhere(input: {
		tenantId: string;
		userId: string;
		canViewAll: boolean;
	}): Prisma.PropertyEngagementWhereInput {
		return {
			tenantId: input.tenantId,
			archivedAt: null,
			status: { notIn: inactiveEngagementStatuses },
			...(input.canViewAll
				? {}
				: {
						agents: {
							some: { tenantId: input.tenantId, agentUserId: input.userId },
						},
					}),
		};
	}
}
