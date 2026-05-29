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
  it('renders copy invitation action for invited owners', () => {
    renderPropertyOwnerCard({ owners: [invitedOwner], onCopyInvitationLink: vi.fn() });

    expect(screen.getByRole('button', { name: /copiar invitación/i })).toBeInTheDocument();
  });

  it('does not render copy invitation action for active owners', () => {
    renderPropertyOwnerCard({ owners: [activeOwner], onCopyInvitationLink: vi.fn() });

    expect(screen.queryByRole('button', { name: /copiar invitación/i })).not.toBeInTheDocument();
  });

  it('calls onCopyInvitationLink with the invited owner when clicked', async () => {
    const user = userEvent.setup();
    const onCopyInvitationLink = vi.fn();
    renderPropertyOwnerCard({ owners: [invitedOwner], onCopyInvitationLink });

    await user.click(screen.getByRole('button', { name: /copiar invitación/i }));

    expect(onCopyInvitationLink).toHaveBeenCalledWith(invitedOwner);
  });

  it('disables the matching owner copy action while copying', () => {
    renderPropertyOwnerCard({
      owners: [invitedOwner],
      copyingInvitationOwnerId: invitedOwner.id,
      onCopyInvitationLink: vi.fn()
    });

    expect(screen.getByRole('button', { name: /copiar invitación/i })).toBeDisabled();
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
      onLinkOwner={vi.fn()}
      {...props}
    />
  );
}
