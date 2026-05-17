// Slice 6 documents UX behavior is documented in docs/plans/2026-05-16-viewpro-stage-9-frontend-mvp-implementation.md.

import { apiRequest } from './api-client'

export type DocumentRequestStatus = 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type DocumentVersionStatus = 'PENDING_UPLOAD' | 'UPLOADED' | 'APPROVED' | 'REJECTED'

export type SignedStorageUrl = {
  url: string
  storageKey: string
  expiresInSeconds: number
}

export type DocumentVersion = {
  id: string
  documentId: string
  uploadedByUserId: string
  storageKey: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  checksum: string | null
  status: DocumentVersionStatus
  createdAt: string
  updatedAt: string
}

export type DocumentRequest = {
  id: string
  tenantId: string
  propertyEngagementId: string
  ownerUserId: string
  requestedByUserId: string
  title: string
  description: string | null
  status: DocumentRequestStatus
  reviewedByUserId: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  updatedAt: string
  currentVersion: DocumentVersion | null
  versions: DocumentVersion[]
}

export type ListDocumentRequestsResponse = {
  items: DocumentRequest[]
  total: number
  page: number
  pageSize: number
}

export type CreateDocumentRequestInput = {
  tenantId: string
  propertyEngagementId: string
  ownerUserId: string
  title: string
  description?: string
}

export type ListInternalDocumentRequestsInput = {
  tenantId: string
  page?: number
  pageSize?: number
  status?: DocumentRequestStatus
}

export type ListOwnerDocumentRequestsInput = {
  page?: number
  pageSize?: number
  status?: DocumentRequestStatus
}

export type CreateOwnerDocumentUploadUrlInput = {
  requestId: string
  originalFilename: string
  mimeType: string
  sizeBytes: number
  checksum?: string
}

export type CreateOwnerDocumentUploadUrlResponse = {
  request: DocumentRequest
  version: DocumentVersion
  uploadUrl: SignedStorageUrl
}

export type DocumentVersionUrlResponse = {
  version: DocumentVersion
  readUrl: SignedStorageUrl
}

export function listInternalDocumentRequests(input: ListInternalDocumentRequestsInput) {
  const searchParams = buildDocumentRequestSearchParams(input)

  return apiRequest<ListDocumentRequestsResponse>(`/document-requests?${searchParams.toString()}`, {
    tenantId: input.tenantId,
  })
}

export function createDocumentRequest(input: CreateDocumentRequestInput) {
  const { tenantId, propertyEngagementId, ...body } = input

  return apiRequest<DocumentRequest>(`/property-engagements/${propertyEngagementId}/document-requests`, {
    body,
    method: 'POST',
    tenantId,
  })
}

export function approveDocumentRequest(tenantId: string, requestId: string) {
  return apiRequest<DocumentRequest>(`/document-requests/${requestId}/approve`, {
    method: 'POST',
    tenantId,
  })
}

export function rejectDocumentRequest(tenantId: string, requestId: string, reason: string) {
  return apiRequest<DocumentRequest>(`/document-requests/${requestId}/reject`, {
    body: { reason },
    method: 'POST',
    tenantId,
  })
}

export function createInternalDocumentReadUrl(tenantId: string, versionId: string) {
  return apiRequest<DocumentVersionUrlResponse>(`/document-versions/${versionId}/read-url`, {
    method: 'POST',
    tenantId,
  })
}

export function listOwnerDocumentRequests(input: ListOwnerDocumentRequestsInput = {}) {
  const searchParams = buildDocumentRequestSearchParams(input)

  return apiRequest<ListDocumentRequestsResponse>(`/owner/document-requests?${searchParams.toString()}`)
}

export function createOwnerDocumentUploadUrl(input: CreateOwnerDocumentUploadUrlInput) {
  const { requestId, ...body } = input

  return apiRequest<CreateOwnerDocumentUploadUrlResponse>(`/owner/document-requests/${requestId}/upload-url`, {
    body,
    method: 'POST',
  })
}

export function confirmOwnerDocumentUpload(versionId: string) {
  return apiRequest<DocumentVersion>(`/owner/document-versions/${versionId}/confirm-upload`, {
    method: 'POST',
  })
}

export function createOwnerDocumentReadUrl(versionId: string) {
  return apiRequest<DocumentVersionUrlResponse>(`/owner/document-versions/${versionId}/read-url`, {
    method: 'POST',
  })
}

function buildDocumentRequestSearchParams(input: {
  page?: number
  pageSize?: number
  status?: DocumentRequestStatus
}) {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(input.page ?? 1))
  searchParams.set('pageSize', String(input.pageSize ?? 20))

  if (input.status) {
    searchParams.set('status', input.status)
  }

  return searchParams
}
