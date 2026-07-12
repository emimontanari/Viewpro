import { Injectable } from "@nestjs/common";
import {
	AnalyticsEventName,
	type MovementType,
	Prisma,
	PropertyEngagementStatus,
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type {
	AnalyticsEventRecord,
	AnalyticsRepository,
	CountTenantAnalyticsEventsInput,
	CountTenantAnalyticsEventsForListInput,
	CountTenantReportEventsInput,
	CreateAnalyticsEventInput,
	DashboardTopPropertyRecord,
	DashboardTopSellerRecord,
	InactiveEngagementRecord,
	ListTenantAnalyticsEventsInput,
	TenantWindowInput,
} from "./analytics.repository";

const INACTIVE_STATUSES = [
	PropertyEngagementStatus.CLOSED,
	PropertyEngagementStatus.CANCELLED,
];

@Injectable()
export class PrismaAnalyticsRepository implements AnalyticsRepository {
	constructor(private readonly prisma: PrismaService) {}

	create(input: CreateAnalyticsEventInput): Promise<AnalyticsEventRecord> {
		return this.prisma.analyticsEvent.create({
			data: {
				tenantId: input.tenantId ?? null,
				actorUserId: input.actorUserId ?? null,
				actorType: input.actorType,
				eventName: input.eventName,
				propertyEngagementId: input.propertyEngagementId ?? null,
				propertyAssetId: input.propertyAssetId ?? null,
				documentRequestId: input.documentRequestId ?? null,
				movementId: input.movementId ?? null,
				metadata: input.metadata ?? Prisma.JsonNull,
				occurredAt: input.occurredAt ?? new Date(),
			},
		});
	}

	listTenantEvents(
		input: ListTenantAnalyticsEventsInput,
	): Promise<AnalyticsEventRecord[]> {
		return this.prisma.analyticsEvent.findMany({
			where: this.buildTenantEventWhere(input),
			orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
			skip: (input.page - 1) * input.pageSize,
			take: input.pageSize,
		});
	}

	countTenantEvents(input: CountTenantAnalyticsEventsInput): Promise<number> {
		return this.prisma.analyticsEvent.count({
			where: {
				...this.buildTenantEventWhere(input),
				occurredAt: { gte: input.from, lt: input.to },
			},
		});
	}

	countTenantEventsForList(
		input: CountTenantAnalyticsEventsForListInput,
	): Promise<number> {
		return this.prisma.analyticsEvent.count({
			where: this.buildTenantEventWhere(input),
		});
	}

	async countTenantReportEvents(
		input: CountTenantReportEventsInput,
	): Promise<number> {
		const scopedReferenceFilters = await this.buildTenantReferenceFilters(
			input.tenantId,
			input.eventName,
		);

		return this.prisma.analyticsEvent.count({
			where: {
				eventName: input.eventName,
				occurredAt: { gte: input.from, lt: input.to },
				OR: [{ tenantId: input.tenantId }, ...scopedReferenceFilters],
			},
		});
	}

	countActiveEngagements(input: { tenantId: string }): Promise<number> {
		return this.prisma.propertyEngagement.count({
			where: this.buildActiveEngagementWhere(input.tenantId),
		});
	}

	async countActiveEngagementsWithOwnerVisibleUpdate(
		input: TenantWindowInput,
	): Promise<number> {
		const updatedEngagementIds = await this.listUpdatedEngagementIds(input);

		if (updatedEngagementIds.length === 0) {
			return 0;
		}

		return this.prisma.propertyEngagement.count({
			where: {
				...this.buildActiveEngagementWhere(input.tenantId),
				id: { in: updatedEngagementIds },
			},
		});
	}

	async listActiveEngagementsWithoutRecentUpdate(
		input: TenantWindowInput,
	): Promise<InactiveEngagementRecord[]> {
		const updatedEngagementIds = await this.listUpdatedEngagementIds(input);

		return this.prisma.propertyEngagement.findMany({
			where: {
				...this.buildActiveEngagementWhere(input.tenantId),
				...(updatedEngagementIds.length > 0
					? { id: { notIn: updatedEngagementIds } }
					: {}),
			},
			select: {
				id: true,
				tenantId: true,
				propertyAssetId: true,
				status: true,
				updatedAt: true,
			},
			orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
		});
	}

	countMovementsInWindow(input: TenantWindowInput): Promise<number> {
		return this.prisma.movement.count({
			where: {
				tenantId: input.tenantId,
				createdAt: { gte: input.from, lt: input.to },
				propertyEngagement: this.buildActiveEngagementWhere(input.tenantId),
			},
		});
	}

	countActiveEngagementsWithoutRecentMovement(
		input: TenantWindowInput,
	): Promise<number> {
		return this.prisma.propertyEngagement.count({
			where: {
				...this.buildActiveEngagementWhere(input.tenantId),
				movements: { none: { createdAt: { gte: input.from, lt: input.to } } },
			},
		});
	}

	async countActiveEngagementsNeedingAttention(
		input: TenantWindowInput & { movementTypes: MovementType[] },
	): Promise<number> {
		const engagements = await this.prisma.propertyEngagement.findMany({
			where: this.buildActiveEngagementWhere(input.tenantId),
			select: {
				movements: {
					where: { createdAt: { gte: input.from, lt: input.to } },
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
					take: 1,
					select: { type: true, nextStep: true },
				},
			},
		});
		const attentionTypes = new Set(input.movementTypes);

		return engagements.filter((engagement) => {
			const latestMovement = engagement.movements[0];

			return (
				latestMovement &&
				attentionTypes.has(latestMovement.type) &&
				!latestMovement.nextStep?.trim()
			);
		}).length;
	}

	async listTopPropertiesByActivity(
		input: TenantWindowInput & { limit: number },
	): Promise<DashboardTopPropertyRecord[]> {
		const [movementGroups, documentGroups] = await Promise.all([
			this.prisma.movement.groupBy({
				by: ["propertyEngagementId"],
				where: {
					tenantId: input.tenantId,
					createdAt: { gte: input.from, lt: input.to },
					propertyEngagement: this.buildActiveEngagementWhere(input.tenantId),
				},
				_count: { _all: true },
			}),
			this.prisma.documentRequest.groupBy({
				by: ["propertyEngagementId"],
				where: {
					tenantId: input.tenantId,
					createdAt: { gte: input.from, lt: input.to },
					propertyEngagement: this.buildActiveEngagementWhere(input.tenantId),
				},
				_count: { _all: true },
			}),
		]);
		const summaries = new Map<
			string,
			{
				movementCount: number;
				documentRequestCount: number;
				lastActivityAt: Date | null;
				lastActivityTitle: string | null;
			}
		>();

		for (const group of movementGroups) {
			summaries.set(group.propertyEngagementId, {
				movementCount: group._count._all,
				documentRequestCount: 0,
				lastActivityAt: null,
				lastActivityTitle: null,
			});
		}

		for (const group of documentGroups) {
			const summary = summaries.get(group.propertyEngagementId) ?? {
				movementCount: 0,
				documentRequestCount: 0,
				lastActivityAt: null,
				lastActivityTitle: null,
			};
			summary.documentRequestCount = group._count._all;
			summaries.set(group.propertyEngagementId, summary);
		}

		const engagementIds = [...summaries.keys()];

		if (engagementIds.length === 0) {
			return [];
		}

		const [engagements, latestMovements, latestDocumentRequests] =
			await Promise.all([
				this.prisma.propertyEngagement.findMany({
					where: { id: { in: engagementIds }, tenantId: input.tenantId },
					include: {
						propertyAsset: true,
						agents: {
							include: {
								agentUser: {
									select: { id: true, email: true, firstName: true },
								},
							},
							orderBy: { assignedAt: "asc" },
						},
					},
				}),
				this.prisma.movement.findMany({
					where: {
						tenantId: input.tenantId,
						propertyEngagementId: { in: engagementIds },
						createdAt: { gte: input.from, lt: input.to },
					},
					select: {
						propertyEngagementId: true,
						observation: true,
						createdAt: true,
						id: true,
					},
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
				this.prisma.documentRequest.findMany({
					where: {
						tenantId: input.tenantId,
						propertyEngagementId: { in: engagementIds },
						createdAt: { gte: input.from, lt: input.to },
					},
					select: {
						propertyEngagementId: true,
						title: true,
						createdAt: true,
						id: true,
					},
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			]);

		for (const movement of latestMovements) {
			const summary = summaries.get(movement.propertyEngagementId);

			if (
				summary &&
				(!summary.lastActivityAt || movement.createdAt > summary.lastActivityAt)
			) {
				summary.lastActivityAt = movement.createdAt;
				summary.lastActivityTitle = movement.observation;
			}
		}

		for (const request of latestDocumentRequests) {
			const summary = summaries.get(request.propertyEngagementId);

			if (
				summary &&
				(!summary.lastActivityAt || request.createdAt > summary.lastActivityAt)
			) {
				summary.lastActivityAt = request.createdAt;
				summary.lastActivityTitle = request.title;
			}
		}

		return [...engagements]
			.flatMap((engagement) => {
				const summary = summaries.get(engagement.id);

				if (!summary?.lastActivityAt || !summary.lastActivityTitle) {
					return [];
				}

				return [
					{
						engagementId: engagement.id,
						propertyId: engagement.propertyAssetId,
						title: engagement.propertyAsset.title,
						addressLine: engagement.propertyAsset.addressLine,
						city: engagement.propertyAsset.city,
						province: engagement.propertyAsset.province,
						status: engagement.status,
						operationType: engagement.operationType,
						agents: engagement.agents.map((agent) => ({
							id: agent.id,
							userId: agent.agentUserId,
							email: agent.agentUser.email,
							firstName: agent.agentUser.firstName,
						})),
						movementCount: summary.movementCount,
						documentRequestCount: summary.documentRequestCount,
						lastActivityAt: summary.lastActivityAt,
						lastActivityTitle: summary.lastActivityTitle,
					},
				];
			})
			.sort((left, right) => {
				const leftCount = left.movementCount + left.documentRequestCount;
				const rightCount = right.movementCount + right.documentRequestCount;

				if (rightCount !== leftCount) {
					return rightCount - leftCount;
				}

				return right.lastActivityAt.getTime() - left.lastActivityAt.getTime();
			})
			.slice(0, input.limit);
	}

	async listTopSellersByMovement(
		input: TenantWindowInput & { limit: number },
	): Promise<DashboardTopSellerRecord[]> {
		const movementGroups = await this.prisma.movement.groupBy({
			by: ["createdByUserId"],
			where: {
				tenantId: input.tenantId,
				createdAt: { gte: input.from, lt: input.to },
				propertyEngagement: this.buildActiveEngagementWhere(input.tenantId),
			},
			_count: { _all: true },
			_max: { createdAt: true },
			orderBy: [
				{ _count: { createdByUserId: "desc" } },
				{ _max: { createdAt: "desc" } },
			],
			take: input.limit,
		});
		const userIds = movementGroups.map((group) => group.createdByUserId);

		if (userIds.length === 0) {
			return [];
		}

		const [users, touchedMovements] = await Promise.all([
			this.prisma.user.findMany({
				where: { id: { in: userIds } },
				select: { id: true, email: true, firstName: true },
			}),
			this.prisma.movement.findMany({
				where: {
					tenantId: input.tenantId,
					createdByUserId: { in: userIds },
					createdAt: { gte: input.from, lt: input.to },
					propertyEngagement: this.buildActiveEngagementWhere(input.tenantId),
				},
				select: { createdByUserId: true, propertyEngagementId: true },
			}),
		]);
		const usersById = new Map(users.map((user) => [user.id, user]));
		const touchedPropertiesByUser = new Map<string, Set<string>>();

		for (const movement of touchedMovements) {
			const touchedProperties =
				touchedPropertiesByUser.get(movement.createdByUserId) ??
				new Set<string>();
			touchedProperties.add(movement.propertyEngagementId);
			touchedPropertiesByUser.set(movement.createdByUserId, touchedProperties);
		}

		return movementGroups.flatMap((group) => {
			const user = usersById.get(group.createdByUserId);
			const lastMovementAt = group._max.createdAt;

			if (!user || !lastMovementAt) {
				return [];
			}

			return [
				{
					userId: user.id,
					name: user.firstName || user.email,
					email: user.email,
					movementCount: group._count._all,
					touchedPropertiesCount:
						touchedPropertiesByUser.get(user.id)?.size ?? 0,
					lastMovementAt,
				},
			];
		});
	}

	private buildTenantEventWhere(
		input: Pick<
			ListTenantAnalyticsEventsInput | CountTenantAnalyticsEventsInput,
			"tenantId" | "eventName"
		>,
	): Prisma.AnalyticsEventWhereInput {
		return {
			tenantId: input.tenantId,
			...(input.eventName ? { eventName: input.eventName } : {}),
		};
	}

	private buildActiveEngagementWhere(
		tenantId: string,
	): Prisma.PropertyEngagementWhereInput {
		return {
			tenantId,
			archivedAt: null,
			status: { notIn: INACTIVE_STATUSES },
		};
	}

	private async listUpdatedEngagementIds(
		input: TenantWindowInput,
	): Promise<string[]> {
		const rows = await this.prisma.analyticsEvent.findMany({
			where: {
				tenantId: input.tenantId,
				eventName: AnalyticsEventName.MOVEMENT_CREATED,
				occurredAt: { gte: input.from, lt: input.to },
				propertyEngagementId: { not: null },
			},
			distinct: ["propertyEngagementId"],
			select: { propertyEngagementId: true },
		});

		return rows.flatMap((row) =>
			row.propertyEngagementId ? [row.propertyEngagementId] : [],
		);
	}

	private async buildTenantReferenceFilters(
		tenantId: string,
		eventName: AnalyticsEventName,
	): Promise<Prisma.AnalyticsEventWhereInput[]> {
		if (
			eventName === AnalyticsEventName.DOCUMENT_REQUESTED ||
			eventName === AnalyticsEventName.DOCUMENT_UPLOADED ||
			eventName === AnalyticsEventName.DOCUMENT_APPROVED ||
			eventName === AnalyticsEventName.DOCUMENT_REJECTED
		) {
			const documentRequests = await this.prisma.documentRequest.findMany({
				where: { tenantId },
				select: { id: true },
			});
			const documentRequestIds = documentRequests.map((request) => request.id);

			return documentRequestIds.length > 0
				? [{ documentRequestId: { in: documentRequestIds } }]
				: [];
		}

		if (eventName === AnalyticsEventName.OWNER_VIEWED_PROPERTY) {
			const engagements = await this.prisma.propertyEngagement.findMany({
				where: { tenantId },
				distinct: ["propertyAssetId"],
				select: { propertyAssetId: true },
			});
			const propertyAssetIds = engagements.map(
				(engagement) => engagement.propertyAssetId,
			);

			return propertyAssetIds.length > 0
				? [{ propertyAssetId: { in: propertyAssetIds } }]
				: [];
		}

		return [];
	}
}
