import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toApiError, type ApiError } from '@/lib/api-client';
import { getSessionWithRefresh, type Session } from '@/lib/session';
import { acceptOwnerInvitation, getOwnerInvitation } from '../api/service';
import type { OwnerInvitationResponse } from '../api/types';
import { OwnerInvitationAcceptanceView } from './owner-invitation-acceptance-view';

vi.mock('../api/service', () => ({
  acceptOwnerInvitation: vi.fn(),
  getOwnerInvitation: vi.fn()
}));

vi.mock('@/lib/session', () => ({
  getSessionWithRefresh: vi.fn()
}));

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock
  })
}));

const getOwnerInvitationMock = vi.mocked(getOwnerInvitation);
const acceptOwnerInvitationMock = vi.mocked(acceptOwnerInvitation);
const getSessionWithRefreshMock = vi.mocked(getSessionWithRefresh);

const invitation: OwnerInvitationResponse = {
  id: 'invitation-1',
  propertyAssetOwnerId: 'owner-link-1',
  email: 'owner@example.com',
  emailRegistered: false,
  ownerFirstName: 'Ana',
  ownerLastName: 'García',
  property: {
    id: 'property-1',
    title: 'Casa Palermo',
    addressLine: 'Uriarte 1234',
    city: 'CABA',
    province: 'Buenos Aires'
  },
  expiresAt: '2026-06-01T10:00:00.000Z'
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
  memberships: []
};

describe('OwnerInvitationAcceptanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerInvitationMock.mockResolvedValue(invitation);
    getSessionWithRefreshMock.mockRejectedValue(apiErrorFrom(401, {}));
    acceptOwnerInvitationMock.mockResolvedValue(acceptedSession);
  });

  it('renders the valid invitation and prefilled editable owner fields', async () => {
    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText('Casa Palermo')).toBeInTheDocument();
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    expect(screen.getByText('Uriarte 1234, CABA, Buenos Aires')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Ana');
    expect(screen.getByLabelText('Apellido')).toHaveValue('García');
  });

  it('accepts the invitation and redirects to the owner portal without leaking the token', async () => {
    const validCredential = 'test-credential-123';
    const user = userEvent.setup();
    render(<OwnerInvitationAcceptanceView token='sensitive-token-1' />);

    await user.clear(await screen.findByLabelText('Nombre *'));
    await user.type(screen.getByLabelText('Nombre *'), 'Anita');
    await user.type(screen.getByLabelText('Contraseña *'), validCredential);
    await user.click(screen.getByRole('button', { name: /Crear cuenta y entrar/ }));

    await waitFor(() => {
      expect(acceptOwnerInvitationMock).toHaveBeenCalledWith('sensitive-token-1', {
        firstName: 'Anita',
        lastName: 'García',
        mode: 'register',
        password: validCredential
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/owner');
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('sensitive-token-1'));
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows a password form for an existing invited owner without a current session', async () => {
    getOwnerInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    const user = userEvent.setup();

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/este email ya tiene cuenta/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nombre *')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Aceptar invitación/ }));

    await waitFor(() => {
      expect(acceptOwnerInvitationMock).toHaveBeenCalledWith('token-1', {
        mode: 'login',
        password: 'test-credential-123'
      });
    });
  });

  it('lets an existing invited owner accept directly from a matching session', async () => {
    getOwnerInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    getSessionWithRefreshMock.mockResolvedValueOnce(acceptedSession);
    const user = userEvent.setup();

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(
      await screen.findByText(/ya estás conectado como owner@example.com/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Aceptar invitación$/ }));

    await waitFor(() => {
      expect(acceptOwnerInvitationMock).toHaveBeenCalledWith('token-1', {
        mode: 'current-session'
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/owner');
  });

  it('shows a wrong-account warning without accepting the invitation', async () => {
    getOwnerInvitationMock.mockResolvedValueOnce({ ...invitation, emailRegistered: true });
    getSessionWithRefreshMock.mockResolvedValueOnce({
      ...acceptedSession,
      user: { ...acceptedSession.user, email: 'otra@example.com' }
    });

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/usá el email invitado/i)).toBeInTheDocument();
    expect(screen.getByText(/la sesión actual es otra@example.com/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Contraseña *')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Aceptar invitación$/ })).not.toBeInTheDocument();
    expect(acceptOwnerInvitationMock).not.toHaveBeenCalled();
  });

  it('shows expired invitation guidance', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(410, { errorCode: 'INVITATION_EXPIRED' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación expiró/i)).toBeInTheDocument();
  });

  it('shows invalid-link guidance for unknown invitations', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(404, { errorCode: 'INVITATION_NOT_FOUND' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/el link de invitación no es válido/i)).toBeInTheDocument();
  });

  it('shows already-accepted guidance with a sign-in link', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(410, { errorCode: 'INVITATION_ALREADY_ACCEPTED' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación ya fue aceptada/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toHaveLength(2);
  });

  it('shows unavailable guidance for revoked invitations', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(410, { errorCode: 'INVITATION_REVOKED' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación ya no está disponible/i)).toBeInTheDocument();
  });

  it('shows submit-time existing-user guidance without redirecting', async () => {
    const user = userEvent.setup();
    acceptOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(409, { errorCode: 'INVITATION_EMAIL_ALREADY_REGISTERED' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    await user.type(await screen.findByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Crear cuenta y entrar/ }));

    expect(await screen.findByText(/este email ya está registrado/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toHaveLength(2);
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('shows email-mismatch guidance for backend 403 responses', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(403, { errorCode: 'INVITATION_EMAIL_MISMATCH' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/usá el email invitado/i)).toBeInTheDocument();
  });

  it('shows session-expired guidance without password copy', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(401, { errorCode: 'SESSION_EXPIRED' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(
      await screen.findByText(/tu sesión expiró mientras completabas la invitación/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/revisá tu contraseña/i)).not.toBeInTheDocument();
  });

  it('shows invalid-credentials guidance distinct from session expiry', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiErrorFrom(401, { errorCode: 'INVITATION_INVALID_CREDENTIALS' })
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/revisá tu contraseña/i)).toBeInTheDocument();
    expect(screen.queryByText(/tu sesión expiró/i)).not.toBeInTheDocument();
  });

  it('prevents submitting without a first name', async () => {
    const user = userEvent.setup();
    render(<OwnerInvitationAcceptanceView token='token-1' />);

    await user.clear(await screen.findByLabelText('Nombre *'));
    await user.type(screen.getByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Crear cuenta y entrar/ }));

    expect(await screen.findByText('Ingresá tu nombre.')).toBeInTheDocument();
    expect(acceptOwnerInvitationMock).not.toHaveBeenCalled();
  });

  it('prevents submitting with a weak password', async () => {
    const user = userEvent.setup();
    render(<OwnerInvitationAcceptanceView token='token-1' />);

    await user.type(await screen.findByLabelText('Contraseña *'), 'short');
    await user.click(screen.getByRole('button', { name: /Crear cuenta y entrar/ }));

    expect(
      await screen.findByText('La contraseña debe tener al menos 8 caracteres.')
    ).toBeInTheDocument();
    expect(acceptOwnerInvitationMock).not.toHaveBeenCalled();
  });
});

function apiErrorFrom(status: number, body: unknown): ApiError {
  return toApiError({ status } as Response, body);
}
