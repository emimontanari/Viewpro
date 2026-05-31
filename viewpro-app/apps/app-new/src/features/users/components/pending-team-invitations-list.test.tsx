import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PendingTeamInvitationsList } from './pending-team-invitations-list';

const pendingInvitations = [
  {
    invitationId: 'invitation-1',
    email: 'agente@example.com',
    role: 'AGENT',
    status: 'PENDING',
    expiresAt: '2026-06-14T10:00:00.000Z',
    createdAt: '2026-05-31T10:00:00.000Z',
    invitedByUserId: 'user-1'
  },
  {
    invitationId: 'invitation-2',
    email: 'manager@example.com',
    role: 'MANAGER',
    status: 'PENDING',
    expiresAt: '2026-06-15T10:00:00.000Z',
    createdAt: '2026-06-01T10:00:00.000Z',
    invitedByUserId: 'user-1'
  }
] as const;

describe('PendingTeamInvitationsList', () => {
  it('renders an empty state', () => {
    renderList({ invitations: [] });

    expect(screen.getByText('No hay invitaciones pendientes')).toBeInTheDocument();
    expect(screen.getByText(/van a aparecer acá/i)).toBeInTheDocument();
  });

  it('renders pending invitation details', () => {
    renderList();

    expect(screen.getByText('agente@example.com')).toBeInTheDocument();
    expect(screen.getByText('manager@example.com')).toBeInTheDocument();
    expect(screen.getByText('Agente')).toBeInTheDocument();
    expect(screen.getByText('Manager')).toBeInTheDocument();
    expect(screen.getByText('14 jun 2026')).toBeInTheDocument();
  });

  it('calls regenerate and revoke handlers with the selected invitation id', async () => {
    const user = userEvent.setup();
    const onRegenerateAndCopy = vi.fn();
    const onRevoke = vi.fn();
    renderList({ onRegenerateAndCopy, onRevoke });

    await user.click(screen.getAllByRole('button', { name: /regenerar y copiar link/i })[0]);
    await user.click(screen.getAllByRole('button', { name: /revocar/i })[1]);

    expect(onRegenerateAndCopy).toHaveBeenCalledWith('invitation-1');
    expect(onRevoke).toHaveBeenCalledWith('invitation-2');
  });

  it('shows a manual copy fallback link', () => {
    renderList({ copiedInvitationUrl: 'http://localhost:3000/team-invitations/fresh-token' });

    expect(screen.getByText('Copiá este link manualmente:')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'http://localhost:3000/team-invitations/fresh-token' })
    ).toHaveAttribute('href', 'http://localhost:3000/team-invitations/fresh-token');
  });
});

function renderList(overrides: Partial<ComponentProps<typeof PendingTeamInvitationsList>> = {}) {
  return render(
    <PendingTeamInvitationsList
      copiedInvitationUrl={null}
      invitations={[...pendingInvitations]}
      onRegenerateAndCopy={vi.fn()}
      onRevoke={vi.fn()}
      {...overrides}
    />
  );
}
