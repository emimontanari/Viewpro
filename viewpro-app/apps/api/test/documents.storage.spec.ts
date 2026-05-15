import { describe, expect, it } from 'vitest'
import { FakeDocumentStorageAdapter } from '../src/documents/storage/fake-document-storage.adapter'

describe('Fake document storage adapter', () => {
  it('creates deterministic upload URLs containing the storage key and TTL', async () => {
    const storage = new FakeDocumentStorageAdapter()

    await expect(
      storage.createUploadUrl({ storageKey: 'documents/request-1/version-1.pdf', expiresInSeconds: 600 }),
    ).resolves.toEqual({
      url: 'https://fake-documents.local/upload/documents%2Frequest-1%2Fversion-1.pdf',
      storageKey: 'documents/request-1/version-1.pdf',
      expiresInSeconds: 600,
    })
  })

  it('creates deterministic read URLs containing the storage key and TTL', async () => {
    const storage = new FakeDocumentStorageAdapter()

    await expect(
      storage.createReadUrl({ storageKey: 'documents/request-1/version-1.pdf', expiresInSeconds: 300 }),
    ).resolves.toEqual({
      url: 'https://fake-documents.local/read/documents%2Frequest-1%2Fversion-1.pdf',
      storageKey: 'documents/request-1/version-1.pdf',
      expiresInSeconds: 300,
    })
  })
})
