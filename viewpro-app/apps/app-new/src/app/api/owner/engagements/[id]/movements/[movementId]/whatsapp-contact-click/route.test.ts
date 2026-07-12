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

function movementWhatsappContactClickRequest() {
  return new NextRequest(
    'http://localhost/api/owner/engagements/engagement-1/movements/movement-1/whatsapp-contact-click',
    { method: 'POST' }
  );
}

describe('owner movement WhatsApp contact click BFF route', () => {
  beforeEach(() => {
    bffFetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    proxyJsonResponseMock.mockClear();
  });

  it('forwards movement contact click tracking to the backend owner endpoint', async () => {
    const backendResponse = new Response(null, { status: 204 });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(movementWhatsappContactClickRequest(), {
      params: Promise.resolve({ id: 'engagement-1', movementId: 'movement-1' })
    });

    expect(bffFetchMock).toHaveBeenCalledWith(
      '/owner/engagements/engagement-1/movements/movement-1/whatsapp-contact-click',
      {
        method: 'POST'
      }
    );
    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(204);
  });

  it('passes backend errors through', async () => {
    const backendResponse = new Response(JSON.stringify({ message: 'Owner movement not found' }), {
      headers: { 'content-type': 'application/json' },
      status: 404
    });
    bffFetchMock.mockResolvedValueOnce(backendResponse);

    const response = await POST(movementWhatsappContactClickRequest(), {
      params: Promise.resolve({ id: 'engagement-1', movementId: 'missing-movement' })
    });

    expect(proxyJsonResponseMock).toHaveBeenCalledWith(backendResponse);
    expect(response.status).toBe(404);
  });

  it('returns a safe fallback when the backend request fails', async () => {
    bffFetchMock.mockRejectedValueOnce(new Error('network failed'));

    const response = await POST(movementWhatsappContactClickRequest(), {
      params: Promise.resolve({ id: 'engagement-1', movementId: 'movement-1' })
    });

    await expect(response.json()).resolves.toEqual({
      message: 'No se pudo registrar el contacto por WhatsApp.'
    });
    expect(response.status).toBe(502);
  });
});
