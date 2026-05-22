import type {
	Movement,
	Prisma,
	PropertyEngagementStatus,
} from "@prisma/client";

export const MOVEMENTS_REPOSITORY = Symbol("MOVEMENTS_REPOSITORY");

export type MovementWithRelations = Prisma.MovementGetPayload<{
	include: { createdBy: true };
}>;

export type ActivityMovementWithRelations = Prisma.MovementGetPayload<{
	include: {
		createdBy: { select: { id: true; email: true; firstName: true } };
		propertyEngagement: {
			include: {
				propertyAsset: true;
				agents: {
					include: {
						agentUser: { select: { id: true; email: true; firstName: true } };
					};
				};
			};
		};
	};
}>;

export type ActivityFeedCounters = {
	todayCount: number;
	staleCount: number;
	attentionCount: number;
};

export type CreateMovementInput = {
	tenantId: string;
	propertyEngagementId: string;
	createdByUserId: string;
	type: Movement["type"];
	observation: string;
	nextStep?: string;
	newStatus?: PropertyEngagementStatus;
	interestCount?: number;
	visitCount?: number;
	offerAmountCents?: number;
	interestLevel?: Movement["interestLevel"];
};

export type ListMovementsInput = {
	tenantId: string;
	propertyEngagementId: string;
	page: number;
	pageSize: number;
	order: "asc" | "desc";
};

export type ListTenantMovementsInput = {
	tenantId: string;
	userId: string;
	canViewAll: boolean;
	page: number;
	pageSize: number;
	type?: Movement["type"];
	createdByUserId?: string;
	from?: Date;
	to?: Date;
};

export type ActivityCountersInput = {
	tenantId: string;
	userId: string;
	canViewAll: boolean;
	now: Date;
};

export type MovementsRepository = {
	create(input: CreateMovementInput): Promise<MovementWithRelations | null>;
	findMany(
		input: ListMovementsInput,
	): Promise<{ items: MovementWithRelations[]; total: number }>;
	findManyByTenant(
		input: ListTenantMovementsInput,
	): Promise<{ items: ActivityMovementWithRelations[]; total: number }>;
	getActivityCounters(
		input: ActivityCountersInput,
	): Promise<ActivityFeedCounters>;
};
