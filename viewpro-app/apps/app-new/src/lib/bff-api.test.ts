import { describe, expect, it } from 'vitest';
import { proxyJsonResponse } from './bff-api';

const CANONICAL_REQUEST_ID = '01234567-89ab-4cde-8fab-0123456789ab';

describe('proxyJsonResponse', () => {
  it('forwards a canonical lowercase UUIDv4 backend request ID', async () => {
    const response = await proxyJsonResponse(
      new Response(JSON.stringify({ accepted: true }), {
        headers: { 'content-type': 'application/json', 'x-request-id': CANONICAL_REQUEST_ID },
        status: 201
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ accepted: true });
    expect(response.headers.get('x-request-id')).toBe(CANONICAL_REQUEST_ID);
  });

  it.each(['01234567-89AB-4CDE-8FAB-0123456789AB', 'not-a-request-id'])('does not forward a non-canonical backend request ID: %s', async (requestId) => {
    const response = await proxyJsonResponse(
      new Response(JSON.stringify({ accepted: true }), {
        headers: { 'content-type': 'application/json', 'x-request-id': requestId },
        status: 201
      })
    );

    expect(response.headers.get('x-request-id')).toBeNull();
  });
});
