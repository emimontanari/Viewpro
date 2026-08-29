import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOwnerDocumentReadUrl,
  trackOwnerMovementWhatsappContactClick,
  trackOwnerWhatsappContactClick,
  uploadOwnerDocumentFile
} from './service';
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

  it('returns upload metadata when production storage responds without JSON', async () => {
    const xhr = createSuccessfulUploadXhr('');
    vi.stubGlobal(
      'XMLHttpRequest',
      vi.fn(function XMLHttpRequest() {
        return xhr;
      })
    );
    const file = new File(['pdf'], 'deed.pdf', { type: 'application/pdf' });

    await expect(
      uploadOwnerDocumentFile(
        {
          url: 'https://viewpro-documents.example.r2.cloudflarestorage.com/document-requests/request-1/deed.pdf?X-Amz-Expires=600',
          storageKey: 'document-requests/request-1/deed.pdf',
          expiresInSeconds: 600
        },
        file,
        { mimeType: 'application/pdf' }
      )
    ).resolves.toEqual({
      storageKey: 'document-requests/request-1/deed.pdf',
      sizeBytes: 3,
      mimeType: 'application/pdf'
    });

    expect(xhr.open).toHaveBeenCalledWith(
      'PUT',
      'https://viewpro-documents.example.r2.cloudflarestorage.com/document-requests/request-1/deed.pdf?X-Amz-Expires=600'
    );
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('content-type', 'application/pdf');
    expect(xhr.send).toHaveBeenCalledWith(file);
  });

  it('tracks WhatsApp contact clicks without sending phone or message metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(trackOwnerWhatsappContactClick('engagement-1')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/engagements/engagement-1/whatsapp-contact-click',
      {
        cache: 'no-store',
        credentials: 'include',
        keepalive: true,
        method: 'POST',
        signal: expect.any(AbortSignal)
      }
    );
  });

  it('tracks movement WhatsApp contact clicks without sending phone or message metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      trackOwnerMovementWhatsappContactClick('engagement-1', 'movement-1')
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/owner/engagements/engagement-1/movements/movement-1/whatsapp-contact-click',
      {
        cache: 'no-store',
        credentials: 'include',
        keepalive: true,
        method: 'POST',
        signal: expect.any(AbortSignal)
      }
    );
  });

  it('fails the movement tracking call without repeating the backend sentence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Owner movement not found' }), {
        headers: { 'content-type': 'application/json' },
        status: 404
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await trackOwnerMovementWhatsappContactClick(
      'engagement-1',
      'missing-movement'
    ).catch((thrown: unknown) => thrown);

    // Still rejects — a caller that awaits this still learns it failed. What
    // changed is that 'Owner movement not found' stays server-side.
    expect((error as { status: number }).status).toBe(404);
    expect((error as Error).message).not.toContain('Owner movement');
  });

  it('fails the tracking call without repeating the backend sentence', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'Property engagement not found' }), {
        headers: { 'content-type': 'application/json' },
        status: 404
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const error = await trackOwnerWhatsappContactClick('missing-engagement').catch(
      (thrown: unknown) => thrown
    );

    expect((error as { status: number }).status).toBe(404);
    expect((error as Error).message).not.toContain('Property engagement');
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

function createSuccessfulUploadXhr(responseText: string) {
  return {
    upload: {},
    status: 200,
    statusText: 'OK',
    responseText,
    open: vi.fn(),
    setRequestHeader: vi.fn(),
    send: vi.fn(function send(this: { onload?: () => void }) {
      this.onload?.();
    }),
    onerror: undefined as (() => void) | undefined,
    onload: undefined as (() => void) | undefined,
    ontimeout: undefined as (() => void) | undefined
  };
}
