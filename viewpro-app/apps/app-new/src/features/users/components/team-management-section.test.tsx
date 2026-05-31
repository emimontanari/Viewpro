import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { createTeamInvitation } from '../api/service';
import { TeamManagementSection } from './team-management-section';

vi.mock('../api/service', () => ({
  createTeamInvitation: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}));

const createTeamInvitationMock = vi.mocked(createTeamInvitation);
const toastMock = vi.mocked(toast);
let writeTextMock: ReturnType<typeof vi.fn>;
const members = [
  {
    membershipId: 'membership-1',
    userId: 'user-1',
    email: 'ana@example.com',
    firstName: 'Ana',
    lastName: 'Gómez',
    userStatus: 'ACTIVE',
    role: 'MANAGER',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z'
  } as const
];

const invitationResponse = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  invitationUrl: 'http://localhost:3000/team-invitations/raw-token-1'
} as const;

describe('TeamManagementSection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: vi.fn() }
      });
    }
    writeTextMock = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    createTeamInvitationMock.mockResolvedValue(invitationResponse);
  });

  it('renders existing team members and opens the invite dialog', async () => {
    const user = userEvent.setup();
    renderTeamManagementSection();

    expect(screen.getByText('ana@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));

    expect(screen.getByRole('dialog', { name: /invitar miembro/i })).toBeInTheDocument();
  });

  it('creates an invitation and copies the returned link', async () => {
    const user = userEvent.setup();
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));
    await user.type(screen.getByLabelText(/email/i), 'agente@example.com');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    await waitFor(() => {
      expect(createTeamInvitationMock).toHaveBeenCalledWith({
        email: 'agente@example.com',
        role: 'AGENT'
      });
    });
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(invitationResponse.invitationUrl);
    });
    expect(
      screen.getByRole('link', { name: invitationResponse.invitationUrl })
    ).toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith('Invitación creada y link copiado.');
  });

  it('keeps the manual link visible when clipboard copy fails', async () => {
    const user = userEvent.setup();
    writeTextMock.mockRejectedValueOnce(new Error('blocked'));
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));
    await user.type(screen.getByLabelText(/email/i), 'agente@example.com');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    expect(
      await screen.findByRole('link', { name: invitationResponse.invitationUrl })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(toastMock.warning).toHaveBeenCalledWith(
        'Invitación creada. Copiá el link manualmente.'
      );
    });
  });

  it('shows API errors without a manual link', async () => {
    const user = userEvent.setup();
    createTeamInvitationMock.mockRejectedValueOnce(new Error('Forbidden'));
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /invitar miembro/i }));
    await user.type(screen.getByLabelText(/email/i), 'agente@example.com');
    await user.click(screen.getByRole('button', { name: /crear invitación/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('Forbidden');
    });
    expect(screen.queryByText('Copiá este link manualmente:')).not.toBeInTheDocument();
  });
});

function renderTeamManagementSection() {
  return render(<TeamManagementSection members={[...members]} />, {
    wrapper: createQueryClientWrapper()
  });
}

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}
