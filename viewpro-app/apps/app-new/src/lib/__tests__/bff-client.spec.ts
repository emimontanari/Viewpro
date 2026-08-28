import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bffRequest,
  GENERIC_BFF_ERROR_MESSAGE,
  hasErrorCode,
  isBffError
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
});
