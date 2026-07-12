import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function confirmUploadRequest() {
  return new NextRequest('http://localhost/api/owner/document-versions/version-1/confirm-upload', {
    method: 'POST'
  });
}

describe('owner document confirm-upload BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'version-1', status: 'UPLOADED' }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('forwards confirm-upload to the backend owner endpoint', async () => {
    await POST(confirmUploadRequest(), { params: Promise.resolve({ id: 'version-1' }) });

    expect(bffFetchMock).toHaveBeenCalledWith('/owner/document-versions/version-1/confirm-upload', {
      method: 'POST'
    });
  });

  it('passes backend errors through', async () => {
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Document version not found' }), {
        headers: { 'content-type': 'application/json' },
        status: 404
      })
    );

    const response = await POST(confirmUploadRequest(), {
      params: Promise.resolve({ id: 'missing-version' })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'Document version not found' });
  });
});
