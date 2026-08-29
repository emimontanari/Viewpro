import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, type ApiError } from './api-client';

const requestId = '8a7e7b9c-6c34-4a56-8f93-9f1c2d3e4b5a';
const genericMessage = 'La solicitud falló.';

describe('apiRequest public error parsing', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps transport status and only valid catalog fields from a public envelope', async () => {
    mockErrorResponse(
      JSON.stringify({
        statusCode: 400,
        errorCode: 'DOCUMENT_DUPLICATE_APPROVED',
        requestId,
        message: 'Server prose must not cross the client boundary',
        details: { internal: true }
      }),
      409
    );

    await expect(apiRequest('/documents')).rejects.toEqual({
      status: 409,
      message: genericMessage,
      errorCode: 'DOCUMENT_DUPLICATE_APPROVED',
      requestId
    } satisfies ApiError);
  });

  it('drops unknown and missing codes while retaining a canonical request ID', async () => {
    mockErrorResponse(JSON.stringify({ errorCode: 'AUTH_REQUIRED', requestId }), 401);

    await expect(apiRequest('/session')).rejects.toEqual({
      status: 401,
      message: genericMessage,
      requestId
    } satisfies ApiError);

    mockErrorResponse(JSON.stringify({ requestId }), 403);

    await expect(apiRequest('/session')).rejects.toEqual({
      status: 403,
      message: genericMessage,
      requestId
    } satisfies ApiError);
  });

  it('drops invalid request IDs and server prose without changing transport status', async () => {
    mockErrorResponse(
      JSON.stringify({
        errorCode: 'REQUEST_FAILED',
        requestId: requestId.toUpperCase(),
        message: 'Credential failure details',
        error: 'Unauthorized',
        details: ['private']
      }),
      503
    );

    await expect(apiRequest('/credentials')).rejects.toEqual({
      status: 503,
      message: genericMessage,
      errorCode: 'REQUEST_FAILED'
    } satisfies ApiError);
  });

  it('rejects lowercase request IDs with non-canonical UUID-v4 shapes', async () => {
    const invalidRequestIds = [
      ['wrong version', '8a7e7b9c-6c34-6a56-8f93-9f1c2d3e4b5a'],
      ['invalid RFC variant', '8a7e7b9c-6c34-4a56-7f93-9f1c2d3e4b5a'],
      ['truncated value', requestId.slice(0, -1)],
      ['extra character', `${requestId}x`]
    ];

    expect(invalidRequestIds).toHaveLength(4);

    for (const [name, invalidRequestId] of invalidRequestIds) {
      mockErrorResponse(JSON.stringify({ errorCode: 'REQUEST_FAILED', requestId: invalidRequestId }), 422);

      await expect(apiRequest(`/request-id-${name}`)).rejects.toEqual({
        status: 422,
        message: genericMessage,
        errorCode: 'REQUEST_FAILED'
      } satisfies ApiError);
    }
  });

  it('uses the local generic fallback for malformed and non-JSON response bodies', async () => {
    mockErrorResponse('{"errorCode":', 502);

    await expect(apiRequest('/broken-json')).rejects.toEqual({
      status: 502,
      message: genericMessage
    } satisfies ApiError);

    mockErrorResponse('upstream HTML error page', 504);

    await expect(apiRequest('/html-error')).rejects.toEqual({
      status: 504,
      message: genericMessage
    } satisfies ApiError);
  });

  it('uses the local generic fallback for an empty error body', async () => {
    mockErrorResponse('', 500);

    await expect(apiRequest('/empty-error')).rejects.toEqual({
      status: 500,
      message: genericMessage
    } satisfies ApiError);
  });

  it('uses the local generic fallback when reading an error body rejects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: vi.fn().mockRejectedValue(new Error('response read failed'))
    } as unknown as Response);

    await expect(apiRequest('/unreadable-error')).rejects.toEqual({
      status: 502,
      message: genericMessage
    } satisfies ApiError);
  });
});

function mockErrorResponse(body: string, status: number) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(body, {
      status,
      statusText: 'Server status text must not cross the client boundary'
    })
  );
}
