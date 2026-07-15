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
