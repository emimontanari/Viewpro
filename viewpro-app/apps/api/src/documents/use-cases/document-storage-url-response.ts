import type { SignedStorageUrl } from '../storage/document-storage.port'
import { mapDocumentVersionResponse, type DocumentVersionResponse } from '../document-response.mapper'
import type { DocumentVersionRecord } from '../documents.repository'

export type DocumentVersionUrlResponse = {
  version: DocumentVersionResponse
  readUrl: SignedStorageUrl
}

export function mapDocumentVersionReadUrlResponse(
  version: DocumentVersionRecord,
  readUrl: SignedStorageUrl,
): DocumentVersionUrlResponse {
  return { version: mapDocumentVersionResponse(version), readUrl }
}
