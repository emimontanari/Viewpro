import type { Prisma } from "@prisma/client";

export const OWNER_PORTAL_REPOSITORY = Symbol("OWNER_PORTAL_REPOSITORY");

export type OwnerPropertyRecord = Prisma.PropertyAssetGetPayload<{
	include: { images: true };
}>;

export type OwnerEngagementRecord = Prisma.PropertyEngagementGetPayload<{
	include: {
		tenant: { select: { id: true; name: true; whatsappPhone: true } };
		agents: {
			select: {
				agentUserId: true;
				agentUser: { select: { firstName: true; email: true; whatsappPhone: true } };
			};
		};
	};
}>;

export type OwnerEngagementContactContext = {
	id: string;
	tenantId: string;
	propertyAssetId: string;
};

export type OwnerMovementContactContext = {
	id: string;
	tenantId: string;
	propertyEngagementId: string;
	propertyAssetId: string;
};

export type OwnerMovementRecord = Prisma.MovementGetPayload<{
	include: {
		createdBy: {
			select: { id: true; email: true; firstName: true; whatsappPhone: true };
		};
		propertyEngagement: {
			select: {
				agents: {
					orderBy: [{ assignedAt: "asc" }, { agentUserId: "asc" }];
					select: {
						agentUserId: true;
						assignedAt: true;
						agentUser: { select: { whatsappPhone: true } };
					};
				};
			};
		};
	};
}>;

export type OwnerPortalRepository = {
	findPropertiesByOwnerUserId(userId: string): Promise<OwnerPropertyRecord[]>;
	findPropertyByOwner(input: {
		userId: string;
		propertyAssetId: string;
	}): Promise<OwnerPropertyRecord | null>;
	findEngagementsForOwnerProperty(input: {
		userId: string;
		propertyAssetId: string;
	}): Promise<OwnerEngagementRecord[]>;
	findEngagementTimelineForOwner(input: {
		userId: string;
		engagementId: string;
		page: number;
		pageSize: number;
		order: "asc" | "desc";
	}): Promise<{
		engagement: OwnerEngagementRecord | null;
		items: OwnerMovementRecord[];
		total: number;
	}>;
	findEngagementContactContextForOwner(input: {
		userId: string;
		engagementId: string;
	}): Promise<OwnerEngagementContactContext | null>;
	findMovementContactContextForOwner(input: {
		userId: string;
		engagementId: string;
		movementId: string;
	}): Promise<OwnerMovementContactContext | null>;
};
