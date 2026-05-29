import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiError } from '@/lib/api-client';
import { acceptOwnerInvitation, getOwnerInvitation } from '../api/service';
import type { OwnerInvitationResponse } from '../api/types';
import { OwnerInvitationAcceptanceView } from './owner-invitation-acceptance-view';

vi.mock('../api/service', () => ({
  acceptOwnerInvitation: vi.fn(),
  getOwnerInvitation: vi.fn()
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

const invitation: OwnerInvitationResponse = {
  id: 'invitation-1',
  propertyAssetOwnerId: 'owner-link-1',
  email: 'owner@example.com',
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

describe('OwnerInvitationAcceptanceView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerInvitationMock.mockResolvedValue(invitation);
    acceptOwnerInvitationMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: invitation.email,
        firstName: 'Ana',
        lastName: 'García',
        status: 'ACTIVE',
        globalRole: 'USER'
      },
      memberships: []
    });
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
        password: validCredential
      });
    });
    expect(pushMock).toHaveBeenCalledWith('/owner');
    expect(pushMock).not.toHaveBeenCalledWith(expect.stringContaining('sensitive-token-1'));
    expect(refreshMock).toHaveBeenCalled();
  });

  it('shows existing-user guidance with a sign-in link', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiError(409, 'Owner email is already registered')
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/este email ya está registrado/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toContainEqual(
      expect.objectContaining({ href: expect.stringContaining('/auth/sign-in') })
    );
  });

  it('shows expired invitation guidance', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(apiError(410, 'Owner invitation has expired'));

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación expiró/i)).toBeInTheDocument();
  });

  it('shows invalid-link guidance for unknown invitations', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(apiError(404, 'Owner invitation not found'));

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/el link de invitación no es válido/i)).toBeInTheDocument();
  });

  it('shows already-accepted guidance with a sign-in link', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiError(410, 'Owner invitation was already accepted')
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación ya fue aceptada/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toContainEqual(
      expect.objectContaining({ href: expect.stringContaining('/auth/sign-in') })
    );
  });

  it('shows unavailable guidance for revoked invitations', async () => {
    getOwnerInvitationMock.mockRejectedValueOnce(
      apiError(410, 'Owner invitation is no longer available')
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    expect(await screen.findByText(/esta invitación ya no está disponible/i)).toBeInTheDocument();
  });

  it('shows submit-time existing-user guidance without redirecting', async () => {
    const user = userEvent.setup();
    acceptOwnerInvitationMock.mockRejectedValueOnce(
      apiError(409, 'Owner email is already registered')
    );

    render(<OwnerInvitationAcceptanceView token='token-1' />);

    await user.type(await screen.findByLabelText('Contraseña *'), 'test-credential-123');
    await user.click(screen.getByRole('button', { name: /Crear cuenta y entrar/ }));

    expect(await screen.findByText(/este email ya está registrado/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /iniciar sesión/i })).toContainEqual(
      expect.objectContaining({ href: expect.stringContaining('/auth/sign-in') })
    );
    expect(pushMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
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

function apiError(status: number, message: string): ApiError {
  return { status, message };
}
