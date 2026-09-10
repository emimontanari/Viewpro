import { cookies, headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from './bff-api';

vi.mock('next/headers', () => ({ cookies: vi.fn(), headers: vi.fn() }));

const CANONICAL_REQUEST_ID = '01234567-89ab-4cde-8fab-0123456789ab';
const fetchMock = vi.fn();
const cookieStore = {
  get: vi.fn(),
  toString: vi.fn()
};

function fetchInit() {
  return fetchMock.mock.calls[0]?.[1] as RequestInit;
}

describe('bffFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(cookies).mockResolvedValue(cookieStore as never);
    vi.mocked(headers).mockResolvedValue(new Headers() as never);
    cookieStore.get.mockReturnValue(undefined);
    cookieStore.toString.mockReturnValue('session=trusted-session');
    fetchMock.mockResolvedValue(new Response('{}'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('forwards the session cookie and caller authorization with the trusted header tenant', async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ 'x-tenant-id': 'header-tenant' }) as never
    );
    cookieStore.get.mockReturnValue({ value: 'cookie-tenant' });

    const body = JSON.stringify({ tenantId: 'body-tenant', proposedByUserId: 'body-proposer' });
    await bffFetch('/property-proposals', {
      body,
      headers: { authorization: 'Bearer trusted-token' }
    });

    const init = fetchInit();
    const outgoingHeaders = new Headers(init.headers);
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/api/property-proposals', init);
    expect(outgoingHeaders.get('cookie')).toBe('session=trusted-session');
    expect(outgoingHeaders.get('authorization')).toBe('Bearer trusted-token');
    expect(outgoingHeaders.get('x-tenant-id')).toBe('header-tenant');
    expect(init.body).toBe(body);
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to the selected-tenant cookie when no trusted tenant header exists', async () => {
    cookieStore.get.mockReturnValue({ value: 'cookie-tenant' });

    await bffFetch('/property-proposals');

    expect(new Headers(fetchInit().headers).get('x-tenant-id')).toBe('cookie-tenant');
  });

  it('aborts a timed-out backend fetch and always clears its timer', async () => {
    vi.useFakeTimers();
    let aborted = false;
    fetchMock.mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            throw new Error('expected bffFetch to supply an abort signal');
          }
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('timed out', 'AbortError'));
          });
        })
    );

    const result = bffFetch('/slow');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledOnce();
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(aborted).toBe(true);

    await rejection;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('proxyJsonResponse', () => {
  it.each([
    [201, { accepted: true }],
    [422, { errorCode: 'PROPERTY_PROPOSAL_SUBMISSION_INCOMPLETE' }]
  ])('passes through backend JSON and status %i', async (status, body) => {
    const response = await proxyJsonResponse(
      new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json', 'x-request-id': CANONICAL_REQUEST_ID },
        status
      })
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
    expect(response.headers.get('x-request-id')).toBe(CANONICAL_REQUEST_ID);
  });

  it.each([
    '01234567-89AB-4CDE-8FAB-0123456789AB',
    '01234567-89ab-5cde-8fab-0123456789ab',
    '01234567-89ab-4cde-7fab-0123456789ab',
    'not-a-request-id'
  ])('drops a non-canonical backend request ID: %s', async (requestId) => {
    const response = await proxyJsonResponse(
      new Response(JSON.stringify({ accepted: true }), {
        headers: { 'content-type': 'application/json', 'x-request-id': requestId },
        status: 201
      })
    );

    expect(response.headers.get('x-request-id')).toBeNull();
  });

  it.each([
    [new Response('not json', { status: 422 }), 422],
    [new Response(null, { status: 204 }), 204]
  ])('preserves status with an empty response for malformed or absent backend JSON', async (backend, status) => {
    const response = await proxyJsonResponse(backend);

    expect(response.status).toBe(status);
    await expect(response.text()).resolves.toBe('');
  });
});

describe('proxyBffErrorResponse', () => {
  it('maps backend aborts to a timeout response', async () => {
    const response = proxyBffErrorResponse(
      new DOMException('timed out', 'AbortError'),
      'No se pudieron cargar las propuestas.'
    );

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ message: 'La operación tardó demasiado.' });
  });

  it('maps other backend failures to a network response', async () => {
    const response = proxyBffErrorResponse(new Error('offline'), 'No se pudieron cargar las propuestas.');

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ message: 'No se pudieron cargar las propuestas.' });
  });
});
