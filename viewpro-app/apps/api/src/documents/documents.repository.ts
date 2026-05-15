import type { DocumentRequestStatus, DocumentVersionStatus, Prisma } from '@prisma/client'

export const DOCUMENTS_REPOSITORY = Symbol('DOCUMENTS_REPOSITORY')

export type DocumentRequestRecord = Prisma.DocumentRequestGetPayload<{
  include: {
    document: { include: { currentVersion: true; versions: true } }
    propertyEngagement: { select: { id: true; tenantId: true; propertyAssetId: true } }
  }
}>

export type DocumentVersionRecord = Prisma.DocumentVersionGetPayload<object>

export type CreateDocumentRequestInput = {
  tenantId: string
  propertyEngagementId: string
  ownerUserId: string
  requestedByUserId: string
  title: string
  description?: string | null
}

export type ListInternalDocumentRequestsInput = {
  tenantId: string
  viewerUserId: string
  canViewAll: boolean
  page: number
  pageSize: number
  status?: DocumentRequestStatus
}

export type FindInternalDocumentRequestDetailInput = {
  tenantId: string
  requestId: string
  viewerUserId: string
  canViewAll: boolean
}

export type CreatePendingDocumentVersionInput = {
  documentRequestId: string
  uploadedByUserId: string
  storageKey: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  checksum?: string | null
}

export type MarkDocumentVersionUploadedInput = {
  versionId: string
}

export type ReviewDocumentRequestInput = {
  requestId: string
  tenantId: string
  reviewedByUserId: string
  status: Extract<DocumentRequestStatus, 'APPROVED' | 'REJECTED'>
  versionStatus: Extract<DocumentVersionStatus, 'APPROVED' | 'REJECTED'>
  rejectionReason?: string | null
}

export type FindOwnerDocumentRequestDetailInput = {
  ownerUserId: string
  requestId: string
}

export type DocumentsRepository = {
  createRequest(input: CreateDocumentRequestInput): Promise<DocumentRequestRecord>
  listInternalRequests(
    input: ListInternalDocumentRequestsInput,
  ): Promise<{ items: DocumentRequestRecord[]; total: number }>
  findInternalRequestDetail(
    input: FindInternalDocumentRequestDetailInput,
  ): Promise<DocumentRequestRecord | null>
  findManagerRequestDetail(input: {
    tenantId: string
    requestId: string
  }): Promise<DocumentRequestRecord | null>
  findRequesterRequestDetail(input: {
    tenantId: string
    requestId: string
    requestedByUserId: string
  }): Promise<DocumentRequestRecord | null>
  createPendingVersion(input: CreatePendingDocumentVersionInput): Promise<DocumentVersionRecord>
  markVersionUploaded(input: MarkDocumentVersionUploadedInput): Promise<DocumentVersionRecord | null>
  reviewRequest(input: ReviewDocumentRequestInput): Promise<DocumentRequestRecord | null>
  findOwnerRequestDetail(input: FindOwnerDocumentRequestDetailInput): Promise<DocumentRequestRecord | null>
}
