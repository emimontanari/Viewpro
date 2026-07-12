import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn(),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function readUrlRequest() {
  return new NextRequest('http://localhost/api/document-versions/version-1/read-url', {
    method: 'POST'
  });
}

describe('internal document read-url BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ readUrl: { url: 'https://storage.example/read' } }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
  });

  it('forwards read-url to the backend internal endpoint', async () => {
    await POST(readUrlRequest(), { params: Promise.resolve({ id: 'version-1' }) });

    expect(bffFetchMock).toHaveBeenCalledWith('/document-versions/version-1/read-url', {
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

    const response = await POST(readUrlRequest(), {
      params: Promise.resolve({ id: 'missing-version' })
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ message: 'Document version not found' });
  });
});
