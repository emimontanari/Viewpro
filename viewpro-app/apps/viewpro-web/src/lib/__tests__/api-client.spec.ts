/**
 * T-15 — RED: api-client.ts `code` field + isStepUpRequiredError tests (D12)
 * Spec: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions (precondition)
 *
 * Tests cover:
 *   - toApiError (exercised via apiRequest against a mocked fetch) copies a
 *     403 STEP_UP_REQUIRED response body's `code` into the thrown ApiError
 *   - isStepUpRequiredError(error) is true ONLY for status 403 + code STEP_UP_REQUIRED
 *   - isStepUpRequiredError is false for a plain 403 (no code), a 401 with the
 *     code, and non-ApiError values
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, isStepUpRequiredError, type ApiError } from '../api-client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('toApiError — code propagation (D12)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('copies a 403 STEP_UP_REQUIRED response body code into the thrown ApiError', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(403, {
        statusCode: 403,
        code: 'STEP_UP_REQUIRED',
        message: 'Step-up verification required'
      })
    );

    await expect(apiRequest('/operators/tenants/tenant-1/status')).rejects.toMatchObject({
      status: 403,
      code: 'STEP_UP_REQUIRED'
    });
  });

  it('leaves code undefined for a response body with no code field', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(500, { statusCode: 500, message: 'Error interno del servidor' })
    );

    let caught: ApiError | undefined;
    try {
      await apiRequest('/operators/tenants');
    } catch (error) {
      caught = error as ApiError;
    }

    expect(caught?.status).toBe(500);
    expect(caught?.code).toBeUndefined();
  });
});

describe('isStepUpRequiredError (D12)', () => {
  it('is true for a 403 with code STEP_UP_REQUIRED', () => {
    const error: ApiError = { status: 403, code: 'STEP_UP_REQUIRED', message: 'Step-up verification required' };
    expect(isStepUpRequiredError(error)).toBe(true);
  });

  it('is false for a plain 403 (no code)', () => {
    const error: ApiError = { status: 403, message: 'Forbidden' };
    expect(isStepUpRequiredError(error)).toBe(false);
  });

  it('is false for a 401 carrying the STEP_UP_REQUIRED code (status must also be 403)', () => {
    const error: ApiError = { status: 401, code: 'STEP_UP_REQUIRED', message: 'Unauthorized' };
    expect(isStepUpRequiredError(error)).toBe(false);
  });

  it('is false for non-ApiError values', () => {
    expect(isStepUpRequiredError(new Error('network'))).toBe(false);
    expect(isStepUpRequiredError(null)).toBe(false);
    expect(isStepUpRequiredError(undefined)).toBe(false);
    expect(isStepUpRequiredError('STEP_UP_REQUIRED')).toBe(false);
  });
});

/**
 * T-09 — RED: api-client.ts 401 interceptor tests (D7)
 * Spec: operator-idle-timeout — Global 401 Handling Redirects to Sign-in with
 *   Session-Expired Indication
 *
 * Tests cover:
 *   - a 401 from a non-exempt path triggers a sign-in redirect carrying
 *     reason=session_expired + redirect_url, and apiRequest still rejects
 *   - a 401 from /auth/login, /auth/step-up, /auth/logout does NOT redirect
 *     (login/step-up-attempt/logout 401s stay inline)
 *   - a 403 STEP_UP_REQUIRED from any path does NOT redirect (regression
 *     guard — status-401-only match, does not regress the step-up flow)
 *   - two concurrent non-exempt 401s only redirect once (dedupe guard)
 *
 * Each test dynamically re-imports the module (vi.resetModules) so the
 * module-level `redirecting` dedupe flag starts fresh per test.
 */
describe('apiRequest — 401 session-expired interceptor (D7)', () => {
  const originalFetch = global.fetch;
  const originalLocation = window.location;
  let assignSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    global.fetch = vi.fn();
    assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/operators/tenants', search: '', assign: assignSpy }
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation
    });
    vi.restoreAllMocks();
  });

  async function loadApiRequest() {
    const mod = await import('../api-client');
    return mod.apiRequest;
  }

  it('redirects to sign-in with reason=session_expired for a 401 from a non-exempt path', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, message: 'Unauthorized' })
    );
    const apiRequestFn = await loadApiRequest();

    await expect(apiRequestFn('/operators/tenants')).rejects.toMatchObject({ status: 401 });

    expect(assignSpy).toHaveBeenCalledTimes(1);
    expect(assignSpy).toHaveBeenCalledWith(
      '/auth/sign-in?reason=session_expired&redirect_url=%2Foperators%2Ftenants'
    );
  });

  it('does NOT redirect for a 401 from /auth/login (bad credentials stay inline)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, message: 'Credenciales inválidas.' })
    );
    const apiRequestFn = await loadApiRequest();

    await expect(apiRequestFn('/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401
    });

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does NOT redirect for a 401 from /auth/step-up (wrong step-up password stays inline)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, message: 'Invalid password' })
    );
    const apiRequestFn = await loadApiRequest();

    await expect(apiRequestFn('/auth/step-up', { method: 'POST' })).rejects.toMatchObject({
      status: 401
    });

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does NOT redirect for a 401 from /auth/logout', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(401, { statusCode: 401, message: 'Unauthorized' })
    );
    const apiRequestFn = await loadApiRequest();

    await expect(apiRequestFn('/auth/logout', { method: 'POST' })).rejects.toMatchObject({
      status: 401
    });

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('does NOT redirect for a 403 STEP_UP_REQUIRED (regression guard — status-401-only match)', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      jsonResponse(403, {
        statusCode: 403,
        code: 'STEP_UP_REQUIRED',
        message: 'Step-up verification required'
      })
    );
    const apiRequestFn = await loadApiRequest();

    await expect(
      apiRequestFn('/operators/tenants/tenant-1/status')
    ).rejects.toMatchObject({ status: 403, code: 'STEP_UP_REQUIRED' });

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('dedupes concurrent non-exempt 401s to a single redirect', async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse(401, { statusCode: 401, message: 'Unauthorized' })
    );
    const apiRequestFn = await loadApiRequest();

    const results = await Promise.allSettled([
      apiRequestFn('/operators/tenants'),
      apiRequestFn('/operators/audit')
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });
});
