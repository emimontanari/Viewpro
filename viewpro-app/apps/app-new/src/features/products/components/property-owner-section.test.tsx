import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PropertyLinkedOwner } from '../api/types';
import { PropertyOwnerSection } from './property-owner-section';

const invitedOwner: PropertyLinkedOwner = {
  accessStatus: 'INVITED',
  email: 'owner@example.com',
  firstName: null,
  id: 'owner-link-1',
  isPrimary: true,
  lastName: null,
  ownerFirstName: 'Ana',
  ownerLastName: 'Owner',
  userId: null
};

const invitationUrl = 'http://localhost:3000/owner-invitations/raw-token-1';

describe('PropertyOwnerSection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens the owner link dialog from the owner card', async () => {
    const user = userEvent.setup();
    renderPropertyOwnerSection();

    await user.click(screen.getByRole('button', { name: /vincular propietario/i }));

    expect(screen.getByRole('dialog', { name: /vincular propietario/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellido')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('submits a linked owner through the BFF and closes the dialog', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'owner-link-2' }), {
        headers: { 'content-type': 'application/json' },
        status: 201
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPropertyOwnerSection();

    await user.click(screen.getByRole('button', { name: /vincular propietario/i }));
    await user.type(screen.getByLabelText('Nombre'), 'Ana');
    await user.type(screen.getByLabelText('Apellido'), 'Owner');
    await user.type(screen.getByLabelText('Email'), 'ANA@EXAMPLE.COM');
    await user.click(
      within(screen.getByRole('dialog', { name: /vincular propietario/i })).getByRole('button', {
        name: /vincular propietario/i
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/owners',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toEqual({
      email: 'ana@example.com',
      firstName: 'Ana',
      lastName: 'Owner'
    });
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /vincular propietario/i })
      ).not.toBeInTheDocument();
    });
  });

  it('copies an invitation link for invited owners', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    const fetchMock = mockInvitationLinkResponse();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/owners/owner-link-1/invitation-link',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(writeText).toHaveBeenCalledWith(invitationUrl);
  });

  it('shows the manual invitation fallback when clipboard copy fails', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    vi.stubGlobal('fetch', mockInvitationLinkResponse());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));

    expect(await screen.findByText('Copiá este link manualmente:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: invitationUrl })).toHaveAttribute(
      'href',
      invitationUrl
    );
  });

  it('lets the operator dismiss the manual invitation fallback', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
    vi.stubGlobal('fetch', mockInvitationLinkResponse());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));
    await screen.findByText('Copiá este link manualmente:');

    await user.click(screen.getByRole('button', { name: /listo/i }));

    await waitFor(() => {
      expect(screen.queryByText('Copiá este link manualmente:')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Ver detalle de Ana Owner' })).toBeInTheDocument();
  });

  it('hides owner invitation actions while archived', () => {
    renderPropertyOwnerSection({ isArchived: true, owners: [invitedOwner] });

    expect(screen.queryByRole('button', { name: /vincular propietario/i })).not.toBeInTheDocument();
    expect(
      screen.getByText('Restaurá la propiedad para vincular propietarios.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /regenerar y copiar link/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revocar invitación/i })).not.toBeInTheDocument();
  });

  it('hides owner management actions when owner management is not permitted', () => {
    renderPropertyOwnerSection({ canManageOwners: false, owners: [invitedOwner] });

    expect(screen.getByRole('button', { name: 'Ver detalle de Ana Owner' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /vincular propietario/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /regenerar y copiar link/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revocar invitación/i })).not.toBeInTheDocument();
  });

  it('revokes an invited owner invitation link after confirmation', async () => {
    const user = userEvent.setup();
    const fetchMock = mockInvitationRevokeResponse();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /revocar invitación/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/products/product-1/owners/owner-link-1/invitation-link/revoke',
        expect.objectContaining({ method: 'POST' })
      );
    });
    await expect(
      screen.findByText('Invitación revocada. Podés regenerar un link nuevo cuando quieras.')
    ).resolves.toBeInTheDocument();
  });

  it('keeps the owner card visible and shows revoke errors', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'No pending owner invitation link found' }), {
        headers: { 'content-type': 'application/json' },
        status: 409
      })
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    renderPropertyOwnerSection({ owners: [invitedOwner] });

    await user.click(screen.getByRole('button', { name: /revocar invitación/i }));

    // Was `findByText('No pending owner invitation link found')`: the backend's
    // English sentence, rendered on screen and asserted as correct.
    await expect(
      screen.findByText('No se pudo revocar la invitación.')
    ).resolves.toBeVisible();
    expect(screen.getByRole('button', { name: 'Ver detalle de Ana Owner' })).toBeInTheDocument();
  });
});

function renderPropertyOwnerSection({
  canManageOwners = true,
  isArchived = false,
  ownerEmail = null,
  ownerName = null,
  owners = []
}: {
  canManageOwners?: boolean;
  isArchived?: boolean;
  ownerEmail?: string | null;
  ownerName?: string | null;
  owners?: PropertyLinkedOwner[];
} = {}) {
  return render(
    <PropertyOwnerSection
      canManageOwners={canManageOwners}
      isArchived={isArchived}
      ownerEmail={ownerEmail}
      ownerName={ownerName}
      owners={owners}
      productId='product-1'
    />,
    { wrapper: createQueryClientWrapper() }
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

function mockInvitationRevokeResponse() {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        propertyAssetOwnerId: invitedOwner.id,
        revokedInvitationIds: ['invitation-1'],
        revokedCount: 1
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 201
      }
    )
  );
}

function mockInvitationLinkResponse() {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        email: invitedOwner.email,
        expiresAt: '2026-06-12T10:00:00.000Z',
        invitationId: 'invitation-1',
        invitationUrl,
        propertyAssetOwnerId: invitedOwner.id
      }),
      {
        headers: { 'content-type': 'application/json' },
        status: 201
      }
    )
  );
}
