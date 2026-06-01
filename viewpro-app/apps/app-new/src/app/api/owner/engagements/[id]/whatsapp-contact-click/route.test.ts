import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((error: unknown, fallbackMessage: string) => {
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return Response.json(
      { message: isTimeout ? 'El portal propietario tardó demasiado.' : fallbackMessage },
      { status: isTimeout ? 504 : 502 }
    );
  }),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const proxyJsonResponseMock = vi.mocked(proxyJsonResponse);

function whatsappContactClickRequest() {
  return new NextRequest(
    'http://localhost/api/owner/engagements/engagement-1/whatsapp-contact-click',
    { method: 'POST' }
  );
}

describe('owner WhatsApp contact click BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    proxyJsonResponseMock.mockClear();
  });

  it('forwards contact click tracking to the backend owner endpoint', async () => {
    const backendResponse = new Response(null, { status: 204 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(whatsappContactClickRequest(), {
      params: Promise.resolve({ id: 'engagement-1' })
    });

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/owner/engagements/engagement-1/whatsapp-contact-click',
      {
        method: 'POST'
      }
    );
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(204);
  });

  it('passes backend errors through', async () => {
    const backendResponse = new Response(
      JSON.stringify({ message: 'Property engagement not found' }),
      {
        headers: { 'content-type': 'application/json' },
        status: 404
      }
    );
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(whatsappContactClickRequest(), {
      params: Promise.resolve({ id: 'missing-engagement' })
    });

    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(404);
  });
});
