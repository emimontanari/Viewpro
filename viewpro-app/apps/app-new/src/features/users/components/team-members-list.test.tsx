import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '../api/types';
import { TeamMembersList } from './team-members-list';

const member: User = {
  membershipId: 'membership-1',
  userId: 'user-1',
  email: 'ana@example.com',
  firstName: 'Ana',
  lastName: 'Gómez',
  userStatus: 'ACTIVE',
  role: 'MANAGER',
  membershipStatus: 'ACTIVE',
  deactivatedAt: null,
  deactivatedByUserId: null,
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-02T10:00:00.000Z'
};

const principalMember: User = {
  ...member,
  membershipId: 'membership-principal',
  userId: 'user-principal',
  email: 'principal@example.com',
  firstName: 'Principal',
  role: 'PRINCIPAL_MANAGER'
};

const deactivatedMember: User = {
  ...member,
  membershipId: 'membership-deactivated',
  userId: 'user-deactivated',
  email: 'baja@example.com',
  firstName: 'Baja',
  role: 'AGENT',
  membershipStatus: 'DEACTIVATED',
  deactivatedAt: '2026-06-01T10:00:00.000Z',
  deactivatedByUserId: 'user-principal'
};

describe('TeamMembersList', () => {
  it('renders Spanish table headings and member data', () => {
    render(<TeamMembersList members={[member]} />);

    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rol' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Usuario' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Acceso' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Miembro desde' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Activo')).toHaveLength(2);
  });

  it('renders the Spanish empty state', () => {
    render(<TeamMembersList members={[]} />);

    expect(screen.getByText('No hay miembros del equipo')).toBeInTheDocument();
    expect(
      screen.getByText('No se encontraron miembros para el tenant seleccionado.')
    ).toBeInTheDocument();
  });

  it('does not render member actions without team management permission', () => {
    render(<TeamMembersList members={[member]} />);

    expect(screen.queryByRole('columnheader', { name: 'Acciones' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hacer agente/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar acceso/i })).not.toBeInTheDocument();
  });

  it('renders status badges and hides mutating actions for protected or deactivated members', () => {
    render(
      <TeamMembersList
        canManageTeam
        currentMembershipId='membership-principal'
        members={[principalMember, deactivatedMember]}
      />
    );

    expect(screen.getByText('principal@example.com')).toBeInTheDocument();
    expect(screen.getByText('baja@example.com')).toBeInTheDocument();
    expect(screen.getByText('Desactivado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hacer manager/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar acceso/i })).not.toBeInTheDocument();
  });

  it('does not show self-deactivation but still allows role update for manageable self rows', () => {
    render(<TeamMembersList canManageTeam currentMembershipId='membership-1' members={[member]} />);

    expect(screen.getByRole('button', { name: /hacer agente/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar acceso/i })).not.toBeInTheDocument();
  });

  it('emits role update and deactivate actions', async () => {
    const user = userEvent.setup();
    const onUpdateRole = vi.fn();
    const onDeactivate = vi.fn();

    render(
      <TeamMembersList
        canManageTeam
        currentMembershipId='membership-principal'
        members={[member]}
        onUpdateRole={onUpdateRole}
        onDeactivate={onDeactivate}
      />
    );

    await user.click(screen.getByRole('button', { name: /hacer agente/i }));
    await user.click(screen.getByRole('button', { name: /desactivar acceso/i }));

    expect(onUpdateRole).toHaveBeenCalledWith('membership-1', 'AGENT');
    expect(onDeactivate).toHaveBeenCalledWith('membership-1');
  });
});
