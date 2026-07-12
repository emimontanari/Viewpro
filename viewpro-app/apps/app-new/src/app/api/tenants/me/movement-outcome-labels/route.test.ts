import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch } from '@/lib/bff-api';
import { GET, POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((_error: unknown, msg: string) =>
    new Response(JSON.stringify({ message: msg }), { status: 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);

function makeGetRequest(query = '') {
  return new NextRequest(
    `http://localhost/api/tenants/me/movement-outcome-labels${query}`
  );
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/tenants/me/movement-outcome-labels', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' }
  });
}

const stubLabel = {
  id: 'label-1',
  tenantId: 'tenant-1',
  label: 'Esperando documentos',
  color: '#3B82F6',
  createdByUserId: 'user-1',
  createdAt: '2026-06-15T00:00:00.000Z',
  deletedAt: null
};

describe('GET /api/tenants/me/movement-outcome-labels', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify([stubLabel]), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('forwards activeOnly=true query param to backend', async () => {
    await GET(makeGetRequest('?activeOnly=true'));
    const [path] = bffFetchMock.mock.calls[0];
    expect(path).toBe('/tenants/me/movement-outcome-labels?activeOnly=true');
  });

  it('calls backend without query param when activeOnly is absent', async () => {
    await GET(makeGetRequest());
    const [path] = bffFetchMock.mock.calls[0];
    expect(path).toBe('/tenants/me/movement-outcome-labels');
  });
});

describe('POST /api/tenants/me/movement-outcome-labels', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    bffFetchMock.mockResolvedValue(
      new Response(JSON.stringify(stubLabel), {
        headers: { 'content-type': 'application/json' },
        status: 200
      })
    );
  });

  it('rejects invalid hex color before forwarding', async () => {
    const response = await POST(makePostRequest({ label: 'Test', color: 'invalid-color' }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toEqual(expect.arrayContaining([expect.stringMatching(/hex/i)]));
    expect(bffFetchMock).not.toHaveBeenCalled();
  });

  it('accepts valid hex color and forwards to backend', async () => {
    await POST(makePostRequest({ label: 'Test', color: '#FF5733' }));
    expect(bffFetchMock).toHaveBeenCalledWith(
      '/tenants/me/movement-outcome-labels',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects label exceeding 40 characters', async () => {
    const response = await POST(
      makePostRequest({ label: 'a'.repeat(41) })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toEqual(
      expect.arrayContaining([expect.stringMatching(/40/)])
    );
  });

  it('forwards valid payload without color', async () => {
    await POST(makePostRequest({ label: 'Sin color' }));
    expect(bffFetchMock).toHaveBeenCalledWith(
      '/tenants/me/movement-outcome-labels',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
