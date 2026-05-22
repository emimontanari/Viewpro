import type {
	Prisma,
	PropertyAgent,
	PropertyAssetImage,
	PropertyEngagementStatus,
	PropertyOperationType,
} from "@prisma/client";
import type { PropertyArchiveFilter } from "./dto/list-property-engagements.query";

export const PROPERTY_ENGAGEMENTS_REPOSITORY = Symbol(
	"PROPERTY_ENGAGEMENTS_REPOSITORY",
);

export type PropertyEngagementWithDetails =
	Prisma.PropertyEngagementGetPayload<{
		include: {
			propertyAsset: { include: { images: true } };
			agents: { include: { agentUser: true } };
			createdBy: true;
		};
	}>;

export type CreatePropertyEngagementInput = {
	tenantId: string;
	createdByUserId: string;
	propertyAsset: Prisma.PropertyAssetCreateWithoutEngagementsInput;
	engagement: Omit<
		Prisma.PropertyEngagementUncheckedCreateWithoutPropertyAssetInput,
		"tenantId" | "createdByUserId"
	>;
};

export type ListPropertyEngagementsInput = {
	tenantId: string;
	userId: string;
	canViewAll: boolean;
	page: number;
	pageSize: number;
	status?: PropertyEngagementStatus;
	operationType?: PropertyOperationType;
	archived?: PropertyArchiveFilter;
};

export type CreatePropertyAssetImageInput = {
	id: string;
	propertyAssetId: string;
	uploadedByUserId: string;
	storageKey: string;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
	isPrimary: boolean;
};

export type DeletePropertyAssetImageResult = {
	deletedStorageKey: string;
	promotedImageId: string | null;
};

export type UpdatePropertyEngagementInput = {
	tenantId: string;
	engagementId: string;
	userId: string;
	canViewAll: boolean;
	propertyAsset: Prisma.PropertyAssetUpdateInput;
	engagement: Prisma.PropertyEngagementUncheckedUpdateInput;
};

export type ArchivePropertyEngagementInput = {
	tenantId: string;
	engagementId: string;
	userId: string;
	canViewAll: boolean;
	archivedByUserId: string;
	archiveReason?: string;
};

export type RestorePropertyEngagementInput = {
	tenantId: string;
	engagementId: string;
	userId: string;
	canViewAll: boolean;
};

export type ArchivePropertyEngagementResult =
	| { status: "archived"; engagement: PropertyEngagementWithDetails }
	| { status: "alreadyArchived" }
	| null;

export type RestorePropertyEngagementResult =
	| { status: "restored"; engagement: PropertyEngagementWithDetails }
	| { status: "notArchived" }
	| null;

export type AssignPropertyAgentResult =
	| { status: "assigned"; assignment: PropertyAgent }
	| { status: "alreadyAssigned" };

export type PropertyEngagementsRepository = {
	createWithAsset(
		input: CreatePropertyEngagementInput,
	): Promise<PropertyEngagementWithDetails>;
	findMany(
		input: ListPropertyEngagementsInput,
	): Promise<{ items: PropertyEngagementWithDetails[]; total: number }>;
	findByIdForTenant(input: {
		tenantId: string;
		engagementId: string;
		userId: string;
		canViewAll: boolean;
	}): Promise<PropertyEngagementWithDetails | null>;
	updateForTenant(
		input: UpdatePropertyEngagementInput,
	): Promise<PropertyEngagementWithDetails | null>;
	archiveForTenant(
		input: ArchivePropertyEngagementInput,
	): Promise<ArchivePropertyEngagementResult>;
	restoreForTenant(
		input: RestorePropertyEngagementInput,
	): Promise<RestorePropertyEngagementResult>;
	countImagesForAsset(propertyAssetId: string): Promise<number>;
	createImage(
		input: CreatePropertyAssetImageInput,
	): Promise<PropertyAssetImage>;
	deleteImageForAsset(input: {
		propertyAssetId: string;
		imageId: string;
	}): Promise<DeletePropertyAssetImageResult | null>;
	setImageAsPrimary(input: {
		propertyAssetId: string;
		imageId: string;
	}): Promise<PropertyAssetImage | null>;
	assignAgent(input: {
		tenantId: string;
		engagementId: string;
		agentUserId: string;
		assignedByUserId: string;
	}): Promise<AssignPropertyAgentResult>;
	removeAgent(input: {
		tenantId: string;
		engagementId: string;
		agentId: string;
	}): Promise<boolean>;
};
