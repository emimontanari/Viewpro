import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BffError,
  bffRequest,
  messageFor,
  GENERIC_BFF_ERROR_MESSAGE,
  hasErrorCode,
  isBffError,
  clearLatestApplicationRequestId,
  getLatestApplicationRequestId
} from '@/lib/bff-client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('bffRequest', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
    clearLatestApplicationRequestId();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
  });

  it('returns the parsed body on success', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { phone: '+5493510000000' }));

    await expect(bffRequest('/api/tenants/me/whatsapp-phone')).resolves.toEqual({
      phone: '+5493510000000'
    });
  });

  it('returns undefined for 204 rather than trying to parse a body', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(bffRequest('/api/tenants/me/whatsapp-phone')).resolves.toBeUndefined();
  });

  it('never surfaces the server sentence', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(409, { message: 'Owner is already linked to this property' })
    );

    const error = await bffRequest('/api/x').catch((thrown: unknown) => thrown);

    expect(isBffError(error)).toBe(true);
    expect((error as Error).message).toBe(GENERIC_BFF_ERROR_MESSAGE);
    expect((error as Error).message).not.toContain('already linked');
  });

  it('never surfaces the raw body either', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(500, { message: 'boom', internalTrace: 'do-not-forward' })
    );

    const error = await bffRequest('/api/x').catch((thrown: unknown) => thrown);

    expect(JSON.stringify(error)).not.toContain('do-not-forward');
  });

  it('keeps an errorCode the catalogue recognises', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(409, { errorCode: 'STATUS_CHANGE_REQUEST_SUPERSEDED', message: 'raw' })
    );

    const error = await bffRequest('/api/x').catch((thrown: unknown) => thrown);

    expect(hasErrorCode(error, 'STATUS_CHANGE_REQUEST_SUPERSEDED')).toBe(true);
    expect((error as { status: number }).status).toBe(409);
  });

  it('drops an errorCode the catalogue does not know, instead of trusting it', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(409, { errorCode: 'SOMETHING_INVENTED', message: 'raw' })
    );

    const error = await bffRequest('/api/x').catch((thrown: unknown) => thrown);

    expect(isBffError(error)).toBe(true);
    expect((error as { errorCode?: string }).errorCode).toBeUndefined();
  });

  it('reports the status even when the body is not JSON at all', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response('<html>502</html>', { status: 502 }));

    const error = await bffRequest('/api/x').catch((thrown: unknown) => thrown);

    expect(isBffError(error)).toBe(true);
    expect((error as { status: number }).status).toBe(502);
    expect((error as { errorCode?: string }).errorCode).toBeUndefined();
  });

  it('aborts a request that outlives its timeout, and says so', async () => {
    vi.mocked(global.fetch).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          (init?.signal as AbortSignal | undefined)?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          );
        })
    );

    const error = await bffRequest('/api/x', {}, { timeoutMs: 5 }).catch(
      (thrown: unknown) => thrown
    );

    expect(isBffError(error)).toBe(true);
    expect((error as { status: number }).status).toBe(408);
  });

  it('leaves a caller-supplied signal alone when no timeout is asked for', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const controller = new AbortController();

    await expect(bffRequest('/api/x', { signal: controller.signal })).resolves.toEqual({
      ok: true
    });
    expect(vi.mocked(global.fetch).mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it('does not let a caller turn off credentials or no-store', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    await bffRequest('/api/x', { cache: 'force-cache', credentials: 'omit' });

    expect(vi.mocked(global.fetch).mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      credentials: 'include'
    });
  });

  it('captures a canonical response header in browser memory over a body fallback', async () => {
    const headerRequestId = '01234567-89ab-4cde-8fab-0123456789ab';
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ requestId: '12345678-1234-4abc-8def-123456789abc' }), {
headers: { 'content-type': 'application/json', 'x-request-id': headerRequestId },
status: 200
      })
    );

    await bffRequest('/api/x');

    expect(getLatestApplicationRequestId()).toBe(headerRequestId);
  });

  it('captures a canonical body request ID only when the header is absent', async () => {
    const bodyRequestId = '12345678-1234-4abc-8def-123456789abc';
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { requestId: bodyRequestId }));

    await bffRequest('/api/x');

    expect(getLatestApplicationRequestId()).toBe(bodyRequestId);
  });

  it.each(['12345678-1234-1abc-8def-123456789abc', '12345678-1234-4ABC-8DEF-123456789ABC', 'not-a-request-id'])('does not capture an invalid, uppercase, or non-v4 response ID: %s', async (requestId) => {
    vi.mocked(global.fetch).mockResolvedValueOnce(jsonResponse(200, { requestId }));

    await bffRequest('/api/x');

    expect(getLatestApplicationRequestId()).toBeUndefined();
  });

  it('does not capture or reveal request IDs during SSR', async () => {
    vi.stubGlobal('window', undefined);
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ requestId: '12345678-1234-4abc-8def-123456789abc' }), {
headers: {
'content-type': 'application/json',
'x-request-id': '01234567-89ab-4cde-8fab-0123456789ab'
},
status: 200
      })
    );

    await bffRequest('/api/x');

    expect(getLatestApplicationRequestId()).toBeUndefined();
  });
});

describe('request ID export surface', () => {
  it('exposes only a getter and zero-argument clear lifecycle function', async () => {
    const clientExports = await import('@/lib/bff-client');
    const requestIdExports = Object.keys(clientExports).filter((key) => /requestid/i.test(key));

    expect(requestIdExports.toSorted()).toEqual([
      'clearLatestApplicationRequestId',
      'getLatestApplicationRequestId'
    ]);
    expect(clearLatestApplicationRequestId).toHaveLength(0);
  });
});

describe('messageFor', () => {
  it('prefers the caller fallback over a BffError, which carries nothing showable', () => {
    expect(messageFor(new BffError(500), 'No se pudo subir el documento')).toBe(
      'No se pudo subir el documento'
    );
  });

  it('keeps a locally thrown sentence, because the app wrote that one', () => {
    const local = new Error('La carga del documento tardó demasiado.');

    expect(messageFor(local, 'No se pudo subir el documento')).toBe(
      'La carga del documento tardó demasiado.'
    );
  });

  it('falls back for an empty message or a non-Error', () => {
    expect(messageFor(new Error(''), 'fallback')).toBe('fallback');
    expect(messageFor('a string', 'fallback')).toBe('fallback');
  });
});

