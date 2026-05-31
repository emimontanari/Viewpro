import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '@/lib/api-client';
import { getSessionWithRefresh, type Session } from '@/lib/session';
import { setSelectedTenantId } from '@/lib/tenant-selection';
import { acceptTeamInvitation, getTeamInvitation } from '../api/service';
import type { TeamInvitationResponse } from '../api/types';
import { TeamInvitationAcceptanceView } from './team-invitation-acceptance-view';

vi.mock('../api/service', () => ({
  acceptTeamInvitation: vi.fn(),
  getTeamInvitation: vi.fn()
}));

vi.mock('@/lib/session', () => ({
  getSessionWithRefresh: vi.fn()
}));

vi.mock('@/lib/tenant-selection', () => ({
  setSelectedTenantId: vi.fn()
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

const getTeamInvitationMock = vi.mocked(getTeamInvitation);
const acceptTeamInvitationMock = vi.mocked(acceptTeamInvitation);
const getSessionWithRefreshMock = vi.mocked(getSessionWithRefresh);
const setSelectedTenantIdMock = vi.mocked(setSelectedTenantId);

const invitation: TeamInvitationResponse = {
  email: 'agente@example.com',
  role: 'AGENT',
  status: 'PENDING',
  expiresAt: '2026-06-14T10:00:00.000Z',
  emailRegistered: false,
  tenant: {
    id: 'tenant-1',
    name: 'Inmobiliaria Norte',
    slug: 'inmobiliaria-norte',
    status: 'ACTIVE'
  }
};

const acceptedSession: Session = {
  user: {
    id: 'user-1',
    email: invitation.email,
    firstName: 'Ana',
    lastName: 'García',
    status: 'ACTIVE',
    globalRole: 'USER'
  },
  memberships: [
    {
      id: 'membership-1',
      role: 'AGENT',
      permissions: [],
      tenant: invitation.tenant
    }
  ]
};

describe('TeamInvitationAcceptanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamInvitationMock.mockResolvedValue(invitation);
    getSessionWithRefreshMock.mockRejectedValue(apiError(401, 'Authentication required'));
    acceptTeamInvitationMock.mockResolvedValue(acceptedSession);
  });

  it('renders a registration form for a brand-new invited email', async () => {
    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText('Inmobiliaria Norte')).toBeInTheDocument();
    expect(screen.getByText('agente@example.com')).toBeInTheDocument();
    expect(screen.getByText('Agente')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre *')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña *')).toBeInTheDocument();
  });

  it('registers the invited user, selects the invited tenant, and redirects to dashboard', async () => {
    const user = userEvent.setup();
    render(<TeamInvitationAcceptanceView token='sensitive-token-1' />);

    await user.type(await screen.findByLabelText('Nombre *'), 'Ana');
    await user.type(screen.getByLabelText('Apellido'), 'García');
    await user.type(screen.getByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Crear cuenta y entrar/ }));

    await waitFor(() => {
      expect(acceptTeamInvitationMock).toHaveBeenCalledWith('sensitive-token-1', {
        firstName: 'Ana',
        lastName: 'García',
        mode: 'register',
        password: 'test-credential-123'
      });
    });
    expect(setSelectedTenantIdMock).toHaveBeenCalledWith('tenant-1');
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('sensitive-token-1'));
    expect(refreshMock).toHaveBeenCalled();
  });

  it('lets an existing invited user accept directly from a matching session', async () => {
    getTeamInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    getSessionWithRefreshMock.mockResolvedValueOnce(acceptedSession);
    const user = userEvent.setup();

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(
      await screen.findByText(/ya estás conectado como agente@example.com/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Aceptar invitación$/ }));

    await waitFor(() => {
      expect(acceptTeamInvitationMock).toHaveBeenCalledWith('token-1', {
        mode: 'current-session'
      });
    });
    expect(setSelectedTenantIdMock).toHaveBeenCalledWith('tenant-1');
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a password form for an existing invited user without a current session', async () => {
    getTeamInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    const user = userEvent.setup();

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/este email ya tiene cuenta/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Aceptar invitación/ }));

    await waitFor(() => {
      expect(acceptTeamInvitationMock).toHaveBeenCalledWith('token-1', {
        mode: 'login',
        password: 'test-credential-123'
      });
    });
  });

  it('shows a wrong-account warning without password or direct acceptance actions', async () => {
    getTeamInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    getSessionWithRefreshMock.mockResolvedValueOnce({
      ...acceptedSession,
      user: { ...acceptedSession.user, email: 'otra@example.com' }
    });

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/usá el email invitado/i)).toBeInTheDocument();
    expect(screen.getByText(/la sesión actual es otra@example.com/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña *')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aceptar invitación$/ })).not.toBeInTheDocument();
    expect(acceptTeamInvitationMock).not.toHaveBeenCalled();
  });

  it('shows expired invitation guidance', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(apiError(410, 'Team invitation has expired'));

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación expiró/i)).toBeInTheDocument();
  });

  it('shows invalid-link guidance for unknown invitations', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(apiError(404, 'Team invitation not found'));

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/el link de invitación no es válido/i)).toBeInTheDocument();
  });

  it('shows wrong-account copy for backend 403 responses', async () => {
    getTeamInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    acceptTeamInvitationMock.mockRejectedValueOnce(
      apiError(403, 'Team invitation belongs to another email')
    );
    const user = userEvent.setup();

    render(<TeamInvitationAcceptanceView token='token-1' />);

    await user.type(await screen.findByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Aceptar invitación/ }));

    expect(await screen.findByText(/esta invitación pertenece a otro email/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

function apiError(status: number, message: string): ApiError {
  return { status, message };
}
