import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toApiError, type ApiError } from '@/lib/api-client';
import { resetPassword } from '@/lib/session';
import ResetPasswordViewPage from './reset-password-view';

vi.mock('@/lib/session', () => ({
  resetPassword: vi.fn()
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? 'token-1' : null)
  })
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const resetPasswordMock = vi.mocked(resetPassword);

async function submitNewPassword() {
  const user = userEvent.setup();
  render(<ResetPasswordViewPage />);

  await user.type(screen.getByLabelText('Contraseña nueva *'), 'newpassword1');
  await user.type(screen.getByLabelText('Repetir contraseña *'), 'newpassword1');
  await user.click(screen.getByRole('button', { name: /Guardar contraseña/ }));
}

describe('ResetPasswordViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders its own link-recovery copy for an invalid or expired reset token', async () => {
    resetPasswordMock.mockRejectedValueOnce(
      apiErrorFrom(400, { errorCode: 'AUTH_TOKEN_INVALID' })
    );

    await submitNewPassword();

    expect(
      await screen.findByText(/el link para restablecer la contraseña es inválido o expiró/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('La solicitud falló.')).not.toBeInTheDocument();
  });

  it('renders the existing generic fallback for an ordinary DTO validation failure', async () => {
    resetPasswordMock.mockRejectedValueOnce(apiErrorFrom(400, {}));

    await submitNewPassword();

    expect(await screen.findByText('La solicitud falló.')).toBeInTheDocument();
  });

  it('renders a sane fallback for a non-400 failure', async () => {
    resetPasswordMock.mockRejectedValueOnce(apiErrorFrom(500, {}));

    await submitNewPassword();

    expect(await screen.findByText('La solicitud falló.')).toBeInTheDocument();
  });
});

function apiErrorFrom(status: number, body: unknown): ApiError {
  return toApiError({ status } as Response, body);
}
