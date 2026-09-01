import { bffFetch } from '@/lib/bff-api';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/bff-api', () => ({
  bffFetch: vi.fn(),
  proxyBffErrorResponse: vi.fn((error: unknown, message: string) =>
    Response.json({ message }, { status: error instanceof Error && error.name === 'AbortError' ? 504 : 502 })
  ),
  proxyJsonResponse: vi.fn(async (response: Response) => response)
}));

const bffFetchMock = vi.mocked(bffFetch);
const REQUEST_ID = '01234567-89ab-4cde-8fab-0123456789ab';

function clearRequest() {
  return new NextRequest('http://localhost/api/products/product-1/agents/primary/clear', {
    body: JSON.stringify({ expectedPrimaryAgentId: null }),
    headers: { 'content-type': 'application/json', 'x-tenant-id': 'tenant-1' },
    method: 'POST'
  });
}

describe('clear primary product agent BFF route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([400, 409])('forwards POST body and pass-through %i response with its request ID', async (status) => {
    const errorBody = { errorCode: status === 400 ? 'PRIMARY_AGENT_CANDIDATE_INVALID' : 'PRIMARY_AGENT_STATE_CONFLICT', requestId: REQUEST_ID, statusCode: status };
    bffFetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(errorBody), {
        headers: { 'content-type': 'application/json', 'x-request-id': REQUEST_ID },
        status
      })
    );

    const response = await POST(clearRequest(), { params: Promise.resolve({ id: 'product-1' }) });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(errorBody);
    expect(response.headers.get('x-request-id')).toBe(REQUEST_ID);
    expect(bffFetchMock).toHaveBeenCalledWith('/property-engagements/product-1/agents/primary/clear', {
      body: JSON.stringify({ expectedPrimaryAgentId: null }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

});
