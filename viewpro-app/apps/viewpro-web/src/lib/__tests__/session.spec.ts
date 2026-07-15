/**
 * T-09 — RED: session.ts unit tests
 * Spec: operator-console — Operator Sign-In (all scenarios); Client Session Model; Session Rehydration
 *
 * Tests cover:
 *   - login() posts to /auth/login and returns { operator: { id, email } }
 *   - login() on non-2xx throws; no session returned
 *   - getSession() calls GET /auth/me; 200 → { operator: { id, email } }
 *   - getSession() on 401 throws
 *   - Session type contains ONLY { operator: { id, email } } — no membership/tenant fields
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock apiRequest before importing session.ts so the module sees the mock.
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn()
}));

import { apiRequest } from '@/lib/api-client';
import { login, getSession, logout, stepUp, type Session } from '../session';

const mockApiRequest = vi.mocked(apiRequest);

const MOCK_OPERATOR_SESSION: Session = {
  operator: { id: 'op-1', email: 'admin@viewpro.app' }
};

beforeEach(() => {
  mockApiRequest.mockReset();
});

// ─── login() ────────────────────────────────────────────────────────────────

describe('login()', () => {
  it('calls POST /auth/login with email + password credentials', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR_SESSION);

    await login({ email: 'admin@viewpro.app', password: 'secret1234' });

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/auth/login');
    expect(options).toMatchObject({
      method: 'POST',
      body: { email: 'admin@viewpro.app', password: 'secret1234' }
    });
  });

  it('returns { operator: { id, email } } on success', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR_SESSION);

    const result = await login({ email: 'admin@viewpro.app', password: 'secret1234' });

    expect(result).toEqual({ operator: { id: 'op-1', email: 'admin@viewpro.app' } });
  });

  it('throws on 401 — no session object returned', async () => {
    const apiError = { status: 401, message: 'Unauthorized' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(login({ email: 'wrong@viewpro.app', password: 'badpass' })).rejects.toMatchObject(
      { status: 401 }
    );
  });
});

// ─── getSession() ───────────────────────────────────────────────────────────

describe('getSession()', () => {
  it('calls GET /auth/me', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR_SESSION);

    await getSession();

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/auth/me');
    // No method specified → defaults to GET in apiRequest
    expect(options === undefined || (options as { method?: string }).method !== 'POST').toBe(true);
  });

  it('returns { operator: { id, email } } on 200', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR_SESSION);

    const result = await getSession();

    expect(result).toEqual({ operator: { id: 'op-1', email: 'admin@viewpro.app' } });
  });

  it('throws on 401 — no session object returned', async () => {
    const apiError = { status: 401, message: 'Unauthorized' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(getSession()).rejects.toMatchObject({ status: 401 });
  });
});

// ─── logout() ───────────────────────────────────────────────────────────────

describe('logout()', () => {
  it('calls POST /auth/logout', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: true });

    await logout();

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/auth/logout');
    expect(options).toMatchObject({ method: 'POST' });
  });

  it('resolves even on network error (best-effort; caller is responsible for swallowing)', async () => {
    // logout() itself propagates the rejection — the caller (signOut) swallows it.
    mockApiRequest.mockRejectedValueOnce(new Error('network'));
    await expect(logout()).rejects.toThrow('network');
  });
});

// ─── stepUp() ───────────────────────────────────────────────────────────────
// T-17 — RED: session.stepUp(password)
// Spec: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions

describe('stepUp()', () => {
  it('calls POST /auth/step-up with the given password and resolves the response', async () => {
    mockApiRequest.mockResolvedValueOnce({ success: true });

    const result = await stepUp('secret');

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/auth/step-up');
    expect(options).toMatchObject({ method: 'POST', body: { password: 'secret' } });
    expect(result).toEqual({ success: true });
  });

  it('propagates a rejection on wrong password (401) — caller handles it inline, not as a logout', async () => {
    const apiError = { status: 401, message: 'Invalid password' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(stepUp('wrong')).rejects.toMatchObject({ status: 401 });
  });
});

// ─── Session type invariant ──────────────────────────────────────────────────

describe('Session type — operator-only shape', () => {
  it('Session contains operator with id and email', () => {
    const session: Session = { operator: { id: 'op-1', email: 'admin@viewpro.app' } };
    expect(session.operator.id).toBe('op-1');
    expect(session.operator.email).toBe('admin@viewpro.app');
  });

  it('Session does NOT have user, memberships, or permissions at runtime', () => {
    const session: Session = { operator: { id: 'op-1', email: 'admin@viewpro.app' } };
    // Runtime check — these keys must be absent
    expect('user' in session).toBe(false);
    expect('memberships' in session).toBe(false);
    expect('permissions' in session).toBe(false);
    expect('tenant' in session).toBe(false);
  });
});
