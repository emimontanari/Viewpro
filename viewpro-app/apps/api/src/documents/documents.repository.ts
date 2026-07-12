import type {
	DocumentRequestStatus,
	DocumentVersionStatus,
	Prisma,
} from "@prisma/client";
import type { CanonicalDocumentType } from "./taxonomy/document-taxonomy";

export const DOCUMENTS_REPOSITORY = Symbol("DOCUMENTS_REPOSITORY");

/**
 * Sentinel error thrown by runCreateWithDuplicateGuard when an APPROVED request
 * of the same canonical type already exists on the engagement.
 * The use case maps this to a ConflictException (409).
 */
export class DuplicateApprovedDocumentError extends Error {
	constructor() {
		super(
			"An approved document of this type already exists for this property.",
		);
		this.name = "DuplicateApprovedDocumentError";
	}
}

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

/**
 * Input for the guarded create path.
 * Extends the base create input with the pre-resolved canonical type key.
 * The repository uses this to lock the engagement row, fetch APPROVED titles,
 * and reject if a collision is found — all inside a single $transaction.
 */
export type RunCreateWithDuplicateGuardInput = CreateDocumentRequestInput & {
	canonicalKey: CanonicalDocumentType;
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
	/** Filter document requests to engagements where this user is an assigned PropertyAgent. */
	assignedAgentUserId?: string;
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
	/**
	 * Creates a document request while guarding against duplicate APPROVED requests
	 * of the same canonical type on the same engagement.
	 *
	 * Executes inside a single $transaction:
	 *   1. Locks the engagement row (SELECT FOR UPDATE) to serialize concurrent creates.
	 *   2. Fetches all APPROVED request titles for the engagement.
	 *   3. Resolves each title and compares against input.canonicalKey.
	 *   4. Throws DuplicateApprovedDocumentError on collision (no row is inserted).
	 *   5. Inserts and returns the new DocumentRequest on no collision.
	 */
	runCreateWithDuplicateGuard(
		input: RunCreateWithDuplicateGuardInput,
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
