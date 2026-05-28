import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function uploadUrlRequest(body: unknown) {
  return new NextRequest('http://localhost/api/owner/document-requests/request-1/upload-url', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });
}

describe('owner document upload-url BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ uploadUrl: { url: 'https://storage.example/upload' } }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('forwards upload-url body to the backend owner endpoint', async () => {
    const body = {
      originalFilename: 'Deed.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      checksum: 'sha256:abc123'
    };

    await POST(uploadUrlRequest(body), { params: Promise.resolve({ id: 'request-1' }) });

    expect(bffFetchMock).toHaveBeenCalledWith('/owner/document-requests/request-1/upload-url', {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

  it('passes backend validation errors through', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unsupported document MIME type' }), {
        headers: { 'content-type': 'application/json' },
        status: 400
      })
    );

    const response = await POST(uploadUrlRequest({ mimeType: 'text/plain' }), {
      params: Promise.resolve({ id: 'request-1' })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ message: 'Unsupported document MIME type' });
  });
});
