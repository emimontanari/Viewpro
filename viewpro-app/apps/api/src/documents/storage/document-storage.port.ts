export const DOCUMENT_STORAGE_PORT = Symbol('DOCUMENT_STORAGE_PORT')

export type CreateDocumentUploadUrlInput = {
  storageKey: string
  expiresInSeconds: number
}

export type CreateDocumentReadUrlInput = {
  storageKey: string
  expiresInSeconds: number
}

export type SignedStorageUrl = {
  url: string
  storageKey: string
  expiresInSeconds: number
}

export type DocumentStoragePort = {
  createUploadUrl(input: CreateDocumentUploadUrlInput): Promise<SignedStorageUrl>
  createReadUrl(input: CreateDocumentReadUrlInput): Promise<SignedStorageUrl>
}
