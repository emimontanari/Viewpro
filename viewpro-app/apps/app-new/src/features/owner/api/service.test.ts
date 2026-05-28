import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOwnerDocumentReadUrl, uploadOwnerDocumentFile } from './service';
import type { OwnerDocumentVersionUrlResponse } from './types';

const fakeStorageMessage = 'La API está usando almacenamiento documental fake.';

describe('owner document API service', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fails fast before PUTing to fake document storage URLs', async () => {
    const xhrMock = vi.fn();
    vi.stubGlobal('XMLHttpRequest', xhrMock);

    const file = new File(['demo'], 'avatar.png', { type: 'image/png' });

    await expect(
      uploadOwnerDocumentFile(
        {
          url: 'https://fake-documents.local/upload/document-requests%2Frequest-1%2Favatar.png',
          storageKey: 'document-requests/request-1/avatar.png',
          expiresInSeconds: 600
        },
        file,
        { mimeType: 'image/png' }
      )
    ).rejects.toThrow(fakeStorageMessage);

    expect(xhrMock).not.toHaveBeenCalled();
  });

  it('rejects fake document read URLs before returning them to the UI', async () => {
    const responseBody: OwnerDocumentVersionUrlResponse = {
      version: {
        id: 'version-1',
        documentId: 'document-1',
        uploadedByUserId: 'owner-1',
        storageKey: 'document-requests/request-1/avatar.png',
        originalFilename: 'avatar.png',
        mimeType: 'image/png',
        sizeBytes: 4,
        checksum: null,
        status: 'UPLOADED',
        createdAt: '2026-05-28T10:00:00.000Z',
        updatedAt: '2026-05-28T10:00:00.000Z'
      },
      readUrl: {
        url: 'https://fake-documents.local/read/document-requests%2Frequest-1%2Favatar.png',
        storageKey: 'document-requests/request-1/avatar.png',
        expiresInSeconds: 300
      }
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(responseBody), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(createOwnerDocumentReadUrl('version-1')).rejects.toThrow(fakeStorageMessage);

    expect(fetchMock).toHaveBeenCalledWith('/api/owner/document-versions/version-1/read-url', {
      cache: 'no-store',
      credentials: 'include',
      method: 'POST',
      signal: expect.any(AbortSignal)
    });
  });
});
