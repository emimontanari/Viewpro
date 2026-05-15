import type { DocumentRequestRecord, DocumentVersionRecord } from './documents.repository'

export type DocumentVersionResponse = {
  id: string
  documentId: string
  uploadedByUserId: string
  storageKey: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  checksum: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export type DocumentRequestResponse = {
  id: string
  tenantId: string
  propertyEngagementId: string
  ownerUserId: string
  requestedByUserId: string
  title: string
  description: string | null
  status: string
  reviewedByUserId: string | null
  reviewedAt: Date | null
  rejectionReason: string | null
  createdAt: Date
  updatedAt: Date
  currentVersion: DocumentVersionResponse | null
  versions: DocumentVersionResponse[]
}

export function mapDocumentVersionResponse(version: DocumentVersionRecord): DocumentVersionResponse {
  return {
    id: version.id,
    documentId: version.documentId,
    uploadedByUserId: version.uploadedByUserId,
    storageKey: version.storageKey,
    originalFilename: version.originalFilename,
    mimeType: version.mimeType,
    sizeBytes: version.sizeBytes,
    checksum: version.checksum,
    status: version.status,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  }
}

export function mapDocumentRequestResponse(request: DocumentRequestRecord): DocumentRequestResponse {
  return {
    id: request.id,
    tenantId: request.tenantId,
    propertyEngagementId: request.propertyEngagementId,
    ownerUserId: request.ownerUserId,
    requestedByUserId: request.requestedByUserId,
    title: request.title,
    description: request.description,
    status: request.status,
    reviewedByUserId: request.reviewedByUserId,
    reviewedAt: request.reviewedAt,
    rejectionReason: request.rejectionReason,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    currentVersion: request.document?.currentVersion
      ? mapDocumentVersionResponse(request.document.currentVersion)
      : null,
    versions: request.document?.versions.map(mapDocumentVersionResponse) ?? [],
  }
}
