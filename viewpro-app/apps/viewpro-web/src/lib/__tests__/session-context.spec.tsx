/**
 * T-13 — RED/GREEN: session-context.tsx unit tests
 * Spec: operator-console — Session Rehydration; Cookie and Auth Boundary; D4; D5; D6
 *
 * Tests cover:
 *   - SessionProvider hydrates via getSession() on mount; 200 → session.operator hydrated
 *   - getSession() throws 401 → session is null; no crash
 *   - signOut() clears query cache and redirects to /auth/sign-in
 *   - Context shape: { session, isLoading, signOut } — no tenant/membership fields
 *   - useSession() throws outside provider
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock session.ts so we control getSession and logout
vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn()
}));

// Mock next/navigation
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}));

import { getSession, logout, type Session } from '@/lib/session';
import { SessionProvider, useSession } from '../session-context';

const mockGetSession = vi.mocked(getSession);
const mockLogout = vi.mocked(logout);

const MOCK_SESSION: Session = { operator: { id: 'op-1', email: 'admin@viewpro.app' } };

// Helper: render inside a fresh QueryClient + SessionProvider
function renderWithSession(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{ui}</SessionProvider>
    </QueryClientProvider>
  );
}

// Minimal consumer to inspect the context value
function SessionConsumer() {
  const { session, isLoading, signOut } = useSession();
  return (
    <div>
      <span data-testid='loading'>{isLoading ? 'loading' : 'done'}</span>
      <span data-testid='email'>{session?.operator?.email ?? 'no-session'}</span>
      <button onClick={signOut} data-testid='sign-out'>
        Sign Out
      </button>
      {/* Tenant fields must NOT be accessible — only operator shape */}
      <span data-testid='has-tenant'>{('tenant' in (session ?? {})).toString()}</span>
      <span data-testid='has-memberships'>{('memberships' in (session ?? {})).toString()}</span>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  pushMock.mockReset();
  // Default: logout resolves successfully (best-effort — errors are swallowed by signOut)
  mockLogout.mockResolvedValue({ success: true });
});

// ─── Rehydration ─────────────────────────────────────────────────────────────

describe('SessionProvider — rehydration', () => {
  it('fetches session on mount and exposes operator email (spec: Session Rehydration scenario 1)', async () => {
    mockGetSession.mockResolvedValueOnce(MOCK_SESSION);

    renderWithSession(<SessionConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('email').textContent).toBe('admin@viewpro.app');
    });
    expect(screen.getByTestId('loading').textContent).toBe('done');
  });

  it('calls getSession() exactly once on mount (D4: client-only via TanStack Query)', async () => {
    mockGetSession.mockResolvedValueOnce(MOCK_SESSION);

    renderWithSession(<SessionConsumer />);

    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('admin@viewpro.app'));
    expect(mockGetSession).toHaveBeenCalledOnce();
  });

  it('shows null session while loading', () => {
    // Never resolves — stays in loading state
    mockGetSession.mockReturnValue(new Promise(() => {}));

    renderWithSession(<SessionConsumer />);

    expect(screen.getByTestId('loading').textContent).toBe('loading');
    expect(screen.getByTestId('email').textContent).toBe('no-session');
  });

  it('getSession() throws 401 → session is null; no crash (D6)', async () => {
    const apiError = { status: 401, message: 'Unauthorized' };
    mockGetSession.mockRejectedValueOnce(apiError);

    renderWithSession(<SessionConsumer />);

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('done');
    });

    // session should be null when query errors
    expect(screen.getByTestId('email').textContent).toBe('no-session');
  });

  it('getSession() throws 401 → redirects to /auth/sign-in (D6)', async () => {
    const apiError = { status: 401, message: 'Unauthorized' };
    mockGetSession.mockRejectedValueOnce(apiError);

    renderWithSession(<SessionConsumer />);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/auth/sign-in');
    });
  });
});

// ─── Session shape invariants ─────────────────────────────────────────────────

describe('SessionProvider — context shape (D2)', () => {
  it('session does NOT contain tenant or memberships fields (operator-only shape)', async () => {
    mockGetSession.mockResolvedValueOnce(MOCK_SESSION);

    renderWithSession(<SessionConsumer />);

    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('admin@viewpro.app'));

    expect(screen.getByTestId('has-tenant').textContent).toBe('false');
    expect(screen.getByTestId('has-memberships').textContent).toBe('false');
  });
});

// ─── signOut (D5) ─────────────────────────────────────────────────────────────

describe('SessionProvider — signOut (D5)', () => {
  it('signOut() calls logout() on viewpro-api before redirecting', async () => {
    mockGetSession.mockResolvedValueOnce(MOCK_SESSION);
    const user = userEvent.setup();

    renderWithSession(<SessionConsumer />);
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('admin@viewpro.app'));

    await act(async () => {
      await user.click(screen.getByTestId('sign-out'));
    });

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('signOut() redirects to /auth/sign-in', async () => {
    mockGetSession.mockResolvedValueOnce(MOCK_SESSION);
    const user = userEvent.setup();

    renderWithSession(<SessionConsumer />);
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('admin@viewpro.app'));

    await act(async () => {
      await user.click(screen.getByTestId('sign-out'));
    });

    expect(pushMock).toHaveBeenCalledWith('/auth/sign-in');
  });

  it('signOut() redirects even if logout() rejects (best-effort)', async () => {
    mockGetSession.mockResolvedValueOnce(MOCK_SESSION);
    mockLogout.mockRejectedValueOnce(new Error('network'));
    const user = userEvent.setup();

    renderWithSession(<SessionConsumer />);
    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('admin@viewpro.app'));

    await act(async () => {
      await user.click(screen.getByTestId('sign-out'));
    });

    // redirect must still happen despite logout() rejection
    expect(pushMock).toHaveBeenCalledWith('/auth/sign-in');
  });
});

// ─── Hook guard ───────────────────────────────────────────────────────────────

describe('useSession()', () => {
  it('throws when used outside SessionProvider', () => {
    const ConsumerWithoutProvider = () => {
      useSession();
      return null;
    };

    // Suppress React error boundary output in test
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<ConsumerWithoutProvider />)).toThrow(
      /useSession must be used within SessionProvider/i
    );

    spy.mockRestore();
  });
});
