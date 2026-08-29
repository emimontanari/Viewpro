import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyLinkedOwner } from '../api/types';
import { PropertyOwnerCard } from './property-owner-card';

const invitedOwner: PropertyLinkedOwner = {
  id: 'owner-link-1',
  userId: null,
  email: 'owner@example.com',
  firstName: null,
  lastName: null,
  ownerFirstName: 'Ana',
  ownerLastName: 'Owner',
  isPrimary: true,
  accessStatus: 'INVITED'
};

const activeOwner: PropertyLinkedOwner = {
  ...invitedOwner,
  id: 'owner-link-active',
  userId: 'user-1',
  email: 'active-owner@example.com',
  accessStatus: 'ACTIVE'
};

describe('PropertyOwnerCard', () => {
  it('renders linked owner summary, initials, detail affordance and invited owner actions', () => {
    renderPropertyOwnerCard({
      owners: [invitedOwner],
      onCopyInvitationLink: vi.fn(),
      onRevokeInvitationLink: vi.fn()
    });

    expect(screen.getByText('1 propietario vinculado')).toBeInTheDocument();
    expect(screen.getByText('AO')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver detalle de Ana Owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerar y copiar link/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revocar invitación/i })).toBeInTheDocument();
  });

  it('does not render invitation management actions for active owners', () => {
    renderPropertyOwnerCard({
      owners: [activeOwner],
      onCopyInvitationLink: vi.fn(),
      onRevokeInvitationLink: vi.fn()
    });

    expect(
      screen.queryByRole('button', { name: /regenerar y copiar link/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revocar invitación/i })).not.toBeInTheDocument();
  });

  it('does not render invitation management actions for archived properties', () => {
    renderPropertyOwnerCard({
      isArchived: true,
      owners: [invitedOwner],
      onCopyInvitationLink: vi.fn(),
      onRevokeInvitationLink: vi.fn()
    });

    expect(
      screen.queryByRole('button', { name: /regenerar y copiar link/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revocar invitación/i })).not.toBeInTheDocument();
  });

  it('calls onCopyInvitationLink with the invited owner when clicked', async () => {
    const user = userEvent.setup();
    const onCopyInvitationLink = vi.fn();
    renderPropertyOwnerCard({ owners: [invitedOwner], onCopyInvitationLink });

    await user.click(screen.getByRole('button', { name: /regenerar y copiar link/i }));

    expect(onCopyInvitationLink).toHaveBeenCalledWith(invitedOwner);
  });

  it('disables the matching owner copy action while copying', () => {
    renderPropertyOwnerCard({
      owners: [invitedOwner],
      copyingInvitationOwnerId: invitedOwner.id,
      onCopyInvitationLink: vi.fn()
    });

    expect(screen.getByRole('button', { name: /regenerar y copiar link/i })).toBeDisabled();
  });

  it('calls onRevokeInvitationLink with the invited owner when clicked', async () => {
    const user = userEvent.setup();
    const onRevokeInvitationLink = vi.fn();
    renderPropertyOwnerCard({
      owners: [invitedOwner],
      onCopyInvitationLink: vi.fn(),
      onRevokeInvitationLink
    });

    await user.click(screen.getByRole('button', { name: /revocar invitación/i }));

    expect(onRevokeInvitationLink).toHaveBeenCalledWith(invitedOwner);
  });

  it('shows the owner list before the link action', () => {
    renderPropertyOwnerCard({ owners: [activeOwner] });

    const ownerButton = screen.getByRole('button', { name: 'Ver detalle de Ana Owner' });
    const linkButton = screen.getByRole('button', { name: /vincular propietario/i });

    expect(ownerButton.compareDocumentPosition(linkButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders a temporary manual-copy fallback for the matching owner', () => {
    const invitationUrl = 'http://localhost:3000/owner-invitations/manual-token';
    renderPropertyOwnerCard({
      owners: [invitedOwner],
      manualInvitationFallback: {
        ownerId: invitedOwner.id,
        invitationUrl
      },
      onCopyInvitationLink: vi.fn()
    });

    expect(screen.getByText('Copiá este link manualmente:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: invitationUrl })).toHaveAttribute(
      'href',
      invitationUrl
    );
  });
});

function renderPropertyOwnerCard(props: Partial<ComponentProps<typeof PropertyOwnerCard>> = {}) {
  return render(
    <PropertyOwnerCard
      isArchived={false}
      isLinkDisabled={false}
      ownerEmail={null}
      ownerName={null}
      owners={[]}
      onDismissManualInvitation={vi.fn()}
      onLinkOwner={vi.fn()}
      {...props}
    />
  );
}
