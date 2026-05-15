import { Injectable } from '@nestjs/common'
import type {
  CreateDocumentReadUrlInput,
  CreateDocumentUploadUrlInput,
  DocumentStoragePort,
  SignedStorageUrl,
} from './document-storage.port'

const FAKE_DOCUMENT_STORAGE_ORIGIN = 'https://fake-documents.local'

@Injectable()
export class FakeDocumentStorageAdapter implements DocumentStoragePort {
  createUploadUrl(input: CreateDocumentUploadUrlInput): Promise<SignedStorageUrl> {
    return Promise.resolve(this.createSignedUrl('upload', input.storageKey, input.expiresInSeconds))
  }

  createReadUrl(input: CreateDocumentReadUrlInput): Promise<SignedStorageUrl> {
    return Promise.resolve(this.createSignedUrl('read', input.storageKey, input.expiresInSeconds))
  }

  private createSignedUrl(
    operation: 'upload' | 'read',
    storageKey: string,
    expiresInSeconds: number,
  ): SignedStorageUrl {
    return {
      url: `${FAKE_DOCUMENT_STORAGE_ORIGIN}/${operation}/${encodeURIComponent(storageKey)}`,
      storageKey,
      expiresInSeconds,
    }
  }
}
