import type {
	Movement,
	MovementBuiltInOutcome,
	Prisma,
	PropertyEngagementStatus,
} from "@prisma/client";

export const MOVEMENTS_REPOSITORY = Symbol("MOVEMENTS_REPOSITORY");

export type MovementWithRelations = Prisma.MovementGetPayload<{
	include: { createdBy: true; customOutcomeLabel: true };
}>;

export type ActivityMovementWithRelations = Prisma.MovementGetPayload<{
	include: {
		createdBy: { select: { id: true; email: true; firstName: true } };
		customOutcomeLabel: true;
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
	nextStep?: string | null;
	newStatus?: PropertyEngagementStatus;
	interestCount?: number | null;
	visitCount?: number | null;
	offerAmountCents?: number | null;
	interestLevel?: Movement["interestLevel"] | null;
	builtInOutcome?: MovementBuiltInOutcome | null;
	customOutcomeLabelId?: string | null;
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
	/** Filter movements to engagements where this user is an assigned PropertyAgent. */
	assignedAgentUserId?: string;
	from?: Date;
	to?: Date;
};

export type ActivityCountersInput = {
	tenantId: string;
	userId: string;
	canViewAll: boolean;
	now: Date;
};

export type ActiveOwnerUsersForEngagementInput = {
	tenantId: string;
	propertyEngagementId: string;
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
	listActiveOwnerUserIdsForEngagement(
		input: ActiveOwnerUsersForEngagementInput,
	): Promise<string[]>;
};
