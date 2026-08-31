import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toApiError, type ApiError } from '@/lib/api-client';
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
    globalRole: 'USER',
    emailVerifiedAt: null
  },
  memberships: [
    {
      id: 'membership-1',
      role: 'AGENT',
      permissions: [],
      tenant: invitation.tenant
    }
  ],
  hasOwnerAccess: false
};

describe('TeamInvitationAcceptanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeamInvitationMock.mockResolvedValue(invitation);
    getSessionWithRefreshMock.mockRejectedValue(apiErrorFrom(401, {}));
    acceptTeamInvitationMock.mockResolvedValue(acceptedSession);
  });

  it('renders a registration form for a brand-new invited email', async () => {
    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText('Inmobiliaria Norte')).toBeInTheDocument();
    expect(screen.getByText('agente@example.com')).toBeInTheDocument();
    expect(screen.getByText('Vendedor')).toBeInTheDocument();
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
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(410, { errorCode: 'INVITATION_EXPIRED' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación expiró/i)).toBeInTheDocument();
  });

  it('shows invalid-link guidance for unknown invitations', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(404, { errorCode: 'INVITATION_NOT_FOUND' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/el link de invitación no es válido/i)).toBeInTheDocument();
  });

  it('shows wrong-account copy for backend 403 responses', async () => {
    getTeamInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    acceptTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(403, { errorCode: 'INVITATION_EMAIL_MISMATCH' })
    );
    const user = userEvent.setup();

    render(<TeamInvitationAcceptanceView token='token-1' />);

    await user.type(await screen.findByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Aceptar invitación/ }));

    expect(await screen.findByText(/esta invitación pertenece a otro email/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('shows revoked invitation guidance', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(410, { errorCode: 'INVITATION_REVOKED' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación ya no está disponible/i)).toBeInTheDocument();
  });

  it('shows already-accepted guidance with a sign-in link', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(410, { errorCode: 'INVITATION_ALREADY_ACCEPTED' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/invitación ya aceptada/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toHaveLength(2);
  });

  it('shows already-member guidance distinct from other 409 states', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(409, { errorCode: 'INVITATION_ALREADY_MEMBER' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/ya pertenecés a esta inmobiliaria/i)).toBeInTheDocument();
  });

  it('shows already-registered-email guidance distinct from already-member', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(409, { errorCode: 'INVITATION_EMAIL_ALREADY_REGISTERED' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/ese email ya tiene una cuenta/i)).toBeInTheDocument();
  });

  it('shows tenant-user-limit guidance without a sign-in link', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(409, { errorCode: 'TENANT_USER_LIMIT_EXCEEDED' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(
      await screen.findByText(/la inmobiliaria alcanzó su límite de usuarios/i)
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toHaveLength(1);
  });

  it('shows session-expired guidance without password copy', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(401, { errorCode: 'SESSION_EXPIRED' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(
      await screen.findByText(/tu sesión expiró mientras completabas la invitación/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/revisá tu contraseña/i)).not.toBeInTheDocument();
  });

  it('shows invalid-credentials guidance distinct from session expiry', async () => {
    getTeamInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(401, { errorCode: 'INVITATION_INVALID_CREDENTIALS' })
    );

    render(<TeamInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/revisá tu contraseña/i)).toBeInTheDocument();
    expect(screen.queryByText(/tu sesión expiró/i)).not.toBeInTheDocument();
  });
});

function apiErrorFrom(status: number, body: unknown): ApiError {
  return toApiError({ status } as Response, body);
}
