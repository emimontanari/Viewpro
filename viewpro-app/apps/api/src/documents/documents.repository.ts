import type {
	DocumentRequestStatus,
	DocumentVersionStatus,
	Prisma,
} from "@prisma/client";

export const DOCUMENTS_REPOSITORY = Symbol("DOCUMENTS_REPOSITORY");

export type DocumentRequestRecord = Prisma.DocumentRequestGetPayload<{
	include: {
		document: { include: { currentVersion: true; versions: true } };
		propertyEngagement: {
			select: { id: true; tenantId: true; propertyAssetId: true };
		};
	};
}>;

export type DocumentVersionRecord = Prisma.DocumentVersionGetPayload<object> & {
	document?: {
		documentRequestId: string;
		documentRequest?: {
			id: string;
			tenantId: string;
			requestedByUserId: string | null;
			title: string;
			propertyEngagementId: string;
			propertyEngagement: { propertyAssetId: string };
		} | null;
	} | null;
};

export type ActivityDocumentRequestRecord = Prisma.DocumentRequestGetPayload<{
	include: {
		document: { include: { currentVersion: true } };
		propertyAssetOwner: true;
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
		requestedByUser: { select: { id: true; email: true; firstName: true } };
	};
}>;

export type CreateDocumentRequestInput = {
	tenantId: string;
	propertyEngagementId: string;
	propertyAssetOwnerId: string;
	ownerUserId?: string | null;
	requestedByUserId: string;
	title: string;
	description?: string | null;
};

export type TenantEngagementForDocumentRequest = {
	id: string;
	tenantId: string;
	propertyAssetId: string;
	propertyAssetOwnerId: string;
	ownerUserId: string | null;
};

export type ListInternalDocumentRequestsInput = {
	tenantId: string;
	viewerUserId: string;
	canViewAll: boolean;
	page: number;
	pageSize: number;
	status?: DocumentRequestStatus;
	propertyEngagementId?: string;
};

export type ListOwnerDocumentRequestsInput = {
	ownerUserId: string;
	page: number;
	pageSize: number;
	status?: DocumentRequestStatus;
	propertyEngagementId?: string;
};

export type ListActivityDocumentRequestsInput = {
	tenantId: string;
	viewerUserId: string;
	canViewAll: boolean;
	page: number;
	pageSize: number;
	requestedByUserId?: string;
	from?: Date;
	to?: Date;
	activeEngagementsOnly?: boolean;
};

export type FindInternalDocumentRequestDetailInput = {
	tenantId: string;
	requestId: string;
	viewerUserId: string;
	canViewAll: boolean;
};

export type CreatePendingDocumentVersionInput = {
	documentRequestId: string;
	uploadedByUserId: string;
	storageKey: string;
	originalFilename: string;
	mimeType: string;
	sizeBytes: number;
	checksum?: string | null;
};

export type MarkDocumentVersionUploadedInput = {
	versionId: string;
};

export type ReviewDocumentRequestInput = {
	requestId: string;
	tenantId: string;
	reviewedByUserId: string;
	status: Extract<DocumentRequestStatus, "APPROVED" | "REJECTED">;
	versionStatus: Extract<DocumentVersionStatus, "APPROVED" | "REJECTED">;
	rejectionReason?: string | null;
};

export type FindOwnerDocumentRequestDetailInput = {
	ownerUserId: string;
	requestId: string;
};

export type FindOwnerDocumentVersionInput = {
	ownerUserId: string;
	versionId: string;
};

export type FindInternalDocumentVersionInput = {
	tenantId: string;
	versionId: string;
	viewerUserId: string;
	canViewAll: boolean;
};

export type DocumentsRepository = {
	findTenantEngagementForDocumentRequest(input: {
		tenantId: string;
		propertyEngagementId: string;
		propertyAssetOwnerId?: string;
		ownerUserId?: string;
	}): Promise<TenantEngagementForDocumentRequest | null>;
	createRequest(
		input: CreateDocumentRequestInput,
	): Promise<DocumentRequestRecord>;
	listOwnerRequests(
		input: ListOwnerDocumentRequestsInput,
	): Promise<{ items: DocumentRequestRecord[]; total: number }>;
	listInternalRequests(
		input: ListInternalDocumentRequestsInput,
	): Promise<{ items: DocumentRequestRecord[]; total: number }>;
	listActivityRequests(
		input: ListActivityDocumentRequestsInput,
	): Promise<{ items: ActivityDocumentRequestRecord[]; total: number }>;
	findInternalRequestDetail(
		input: FindInternalDocumentRequestDetailInput,
	): Promise<DocumentRequestRecord | null>;
	findManagerRequestDetail(input: {
		tenantId: string;
		requestId: string;
	}): Promise<DocumentRequestRecord | null>;
	findRequesterRequestDetail(input: {
		tenantId: string;
		requestId: string;
		requestedByUserId: string;
	}): Promise<DocumentRequestRecord | null>;
	createPendingVersion(
		input: CreatePendingDocumentVersionInput,
	): Promise<DocumentVersionRecord>;
	markVersionUploaded(
		input: MarkDocumentVersionUploadedInput,
	): Promise<DocumentVersionRecord | null>;
	reviewRequest(
		input: ReviewDocumentRequestInput,
	): Promise<DocumentRequestRecord | null>;
	findOwnerRequestDetail(
		input: FindOwnerDocumentRequestDetailInput,
	): Promise<DocumentRequestRecord | null>;
	findOwnerPendingUploadVersion(
		input: FindOwnerDocumentVersionInput,
	): Promise<DocumentVersionRecord | null>;
	findOwnerReadableVersion(
		input: FindOwnerDocumentVersionInput,
	): Promise<DocumentVersionRecord | null>;
	findInternalReadableVersion(
		input: FindInternalDocumentVersionInput,
	): Promise<DocumentVersionRecord | null>;
};
