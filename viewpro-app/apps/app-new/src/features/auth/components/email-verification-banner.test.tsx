import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resendVerification } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import { toast } from 'sonner';
import { EmailVerificationBanner } from './email-verification-banner';

vi.mock('@/lib/session', () => ({ resendVerification: vi.fn() }));
vi.mock('@/lib/session-context', () => ({ useSession: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }
}));

const resendMock = vi.mocked(resendVerification);
const useSessionMock = vi.mocked(useSession);

function signedInWithUnverifiedEmail() {
  useSessionMock.mockReturnValue({
    session: { user: { email: 'jane@example.com', emailVerifiedAt: null } }
  } as never);
}

/**
 * The API swallows send failures on purpose: resend-email-verification.use-case.ts
 * catches, logs and returns, so a resolved call proves the request was accepted —
 * never that a message left, and never that it arrived. The copy must not claim
 * more than that (#350).
 */
describe('EmailVerificationBanner — says only what it can back (#350)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signedInWithUnverifiedEmail();
  });

  it('does not claim the email was sent, delivered or received', async () => {
    const user = userEvent.setup();
    resendMock.mockResolvedValue(undefined as never);
    render(<EmailVerificationBanner />);

    await user.click(screen.getByRole('button', { name: 'Reenviar email' }));

    const [message] = vi.mocked(toast.success).mock.calls[0] ?? [];
    expect(message).toBeTypeOf('string');
    expect(message as string).not.toMatch(/te reenviamos|te enviamos|revisá tu bandeja/i);
  });

  it('names the address the request was made for, so the operator can spot a typo', async () => {
    const user = userEvent.setup();
    resendMock.mockResolvedValue(undefined as never);
    render(<EmailVerificationBanner />);

    await user.click(screen.getByRole('button', { name: 'Reenviar email' }));

    const [message] = vi.mocked(toast.success).mock.calls[0] ?? [];
    expect(message as string).toContain('jane@example.com');
  });

  it('keeps a failure distinguishable from a success', async () => {
    const user = userEvent.setup();
    resendMock.mockRejectedValue(new Error('down'));
    render(<EmailVerificationBanner />);

    await user.click(screen.getByRole('button', { name: 'Reenviar email' }));

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('leaves the action available for a retry instead of consuming it', async () => {
    const user = userEvent.setup();
    resendMock.mockResolvedValue(undefined as never);
    render(<EmailVerificationBanner />);

    const button = screen.getByRole('button', { name: 'Reenviar email' });
    await user.click(button);

    expect(button).toBeEnabled();
  });
});
