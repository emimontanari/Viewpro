import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toApiError, type ApiError } from '@/lib/api-client';
import { verifyEmail } from '@/lib/session';
import VerifyEmailViewPage from './verify-email-view';

vi.mock('@/lib/session', () => ({
  verifyEmail: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? 'token-1' : null)
  })
}));

const invalidateQueriesMock = vi.fn();

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock })
  };
});

const verifyEmailMock = vi.mocked(verifyEmail);

describe('VerifyEmailViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders its own link-recovery copy for an invalid or expired verification token', async () => {
    verifyEmailMock.mockRejectedValueOnce(apiErrorFrom(400, { errorCode: 'AUTH_TOKEN_INVALID' }));

    render(<VerifyEmailViewPage />);

    expect(
      await screen.findByText(/el link de verificación es inválido o expiró/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('La solicitud falló.')).not.toBeInTheDocument();
  });

  it('renders the existing generic fallback for an ordinary DTO validation failure', async () => {
    verifyEmailMock.mockRejectedValueOnce(apiErrorFrom(400, {}));

    render(<VerifyEmailViewPage />);

    expect(await screen.findByText('La solicitud falló.')).toBeInTheDocument();
  });

  it('renders a sane fallback for a non-400 failure', async () => {
    verifyEmailMock.mockRejectedValueOnce(apiErrorFrom(500, {}));

    render(<VerifyEmailViewPage />);

    expect(await screen.findByText('La solicitud falló.')).toBeInTheDocument();
  });
});

function apiErrorFrom(status: number, body: unknown): ApiError {
  return toApiError({ status } as Response, body);
}
