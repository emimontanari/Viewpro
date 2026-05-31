import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import {
  createTeamInvitation,
  getTeamInvitations,
  resendTeamInvitation,
  revokeTeamInvitation
} from '../api/service';
import { TeamManagementSection } from './team-management-section';

vi.mock('../api/service', () => ({
  createTeamInvitation: vi.fn(),
  getTeamInvitations: vi.fn(),
  resendTeamInvitation: vi.fn(),
  revokeTeamInvitation: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn()
  }
}));

const createTeamInvitationMock = vi.mocked(createTeamInvitation);
const getTeamInvitationsMock = vi.mocked(getTeamInvitations);
const resendTeamInvitationMock = vi.mocked(resendTeamInvitation);
const revokeTeamInvitationMock = vi.mocked(revokeTeamInvitation);
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

const pendingInvitation = {
  invitationId: 'invitation-1',
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  createdAt: '2026-05-31T10:00:00.000Z',
  invitedByUserId: 'user-1'
} as const;

const refreshedPendingInvitation = {
  ...pendingInvitation,
  invitationId: 'invitation-2',
  expiresAt: '2026-06-15T10:00:00.000Z'
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
    resendTeamInvitationMock.mockResolvedValue({
      ...invitationResponse,
      invitationId: 'invitation-2',
      invitationUrl: 'http://localhost:3000/team-invitations/fresh-token'
    });
    revokeTeamInvitationMock.mockResolvedValue({
      invitationId: 'invitation-1',
      email: 'agente@example.com',
      role: 'AGENT',
      status: 'REVOKED',
      expiresAt: '2026-06-14T10:00:00.000Z',
      revokedAt: '2026-06-01T10:00:00.000Z'
    });
    getTeamInvitationsMock.mockResolvedValue({ items: [refreshedPendingInvitation] });
  });

  it('renders existing team members and opens the invite dialog', async () => {
    const user = userEvent.setup();
    renderTeamManagementSection();

    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getByText('agente@example.com')).toBeInTheDocument();

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

  it('regenerates and copies a fresh pending invitation link', async () => {
    const user = userEvent.setup();
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));

    await waitFor(() => {
      expect(resendTeamInvitationMock).toHaveBeenCalledWith('invitation-1');
    });
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        'http://localhost:3000/team-invitations/fresh-token'
      );
    });
    await waitFor(() => {
      expect(getTeamInvitationsMock).toHaveBeenCalled();
    });
    expect(await screen.findByText('15 jun 2026')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: 'http://localhost:3000/team-invitations/fresh-token'
      })
    ).not.toBeInTheDocument();
    expect(toastMock.success).toHaveBeenCalledWith('Link regenerado y copiado.');
  });

  it('shows a manual pending invitation link when clipboard copy fails', async () => {
    const user = userEvent.setup();
    writeTextMock.mockRejectedValueOnce(new Error('blocked'));
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));

    expect(
      await screen.findByRole('link', {
        name: 'http://localhost:3000/team-invitations/fresh-token'
      })
    ).toBeInTheDocument();
    expect(toastMock.warning).toHaveBeenCalledWith('Link regenerado. Copialo manualmente.');
  });

  it('revokes a pending invitation and removes it from the list', async () => {
    const user = userEvent.setup();
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /revocar/i }));

    await waitFor(() => {
      expect(revokeTeamInvitationMock).toHaveBeenCalledWith('invitation-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('agente@example.com')).not.toBeInTheDocument();
    });
    expect(toastMock.success).toHaveBeenCalledWith('Invitación revocada.');
  });

  it('shows pending invitation action errors without removing the item', async () => {
    const user = userEvent.setup();
    resendTeamInvitationMock.mockRejectedValueOnce(new Error('No autorizado'));
    renderTeamManagementSection();

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalledWith('No autorizado');
    });
    expect(screen.getByText('agente@example.com')).toBeInTheDocument();
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
  return render(
    <TeamManagementSection members={[...members]} pendingInvitations={[pendingInvitation]} />,
    {
      wrapper: createQueryClientWrapper()
    }
  );
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
