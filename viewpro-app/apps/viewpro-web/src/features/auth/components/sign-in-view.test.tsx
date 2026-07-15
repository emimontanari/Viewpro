/**
 * T-11 — RED: sign-in-view `session_expired` Alert tests (D8)
 * Spec: operator-idle-timeout — Global 401 Handling Redirects to Sign-in with
 *   Session-Expired Indication
 *
 * Tests cover:
 *   - `?reason=session_expired` present → renders the destructive Alert with
 *     "Tu sesión expiró. Iniciá sesión de nuevo para continuar."
 *   - no `reason` param → no expiry Alert rendered
 *   - resubmitting the form clears the expiry alert before any new error renders
 */

import * as React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const pushMock = vi.fn();
const refreshMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => searchParamsValue
}));

vi.mock('@/lib/session', () => ({
  login: vi.fn()
}));

import { login } from '@/lib/session';
import { SignInForm } from './sign-in-view';

const mockLogin = vi.mocked(login);

const EXPIRY_COPY = 'Tu sesión expiró. Iniciá sesión de nuevo para continuar.';

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  mockLogin.mockReset();
  searchParamsValue = new URLSearchParams();
});

describe('SignInForm — session_expired Alert (D8)', () => {
  it('renders the expiry alert when reason=session_expired is present', () => {
    searchParamsValue = new URLSearchParams('reason=session_expired');

    render(<SignInForm />);

    expect(screen.getByText(EXPIRY_COPY)).toBeTruthy();
  });

  it('does not render the expiry alert when reason is absent', () => {
    render(<SignInForm />);

    expect(screen.queryByText(EXPIRY_COPY)).toBeNull();
  });

  it('clears the expiry alert before any new error renders on resubmit', async () => {
    searchParamsValue = new URLSearchParams('reason=session_expired');
    mockLogin.mockRejectedValueOnce({ status: 401, message: 'Credenciales inválidas.' });

    render(<SignInForm />);
    expect(screen.getByText(EXPIRY_COPY)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Email/), {
      target: { value: 'operator@viewpro.app' }
    });
    fireEvent.change(screen.getByLabelText(/^Contraseña/), {
      target: { value: 'password123' }
    });
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Credenciales inválidas.')).toBeTruthy();
    });
    expect(screen.queryByText(EXPIRY_COPY)).toBeNull();
  });
});
