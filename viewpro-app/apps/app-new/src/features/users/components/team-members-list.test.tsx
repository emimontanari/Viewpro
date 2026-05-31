import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-02T10:00:00.000Z'
};

describe('TeamMembersList', () => {
  it('renders Spanish table headings and member data', () => {
    render(<TeamMembersList members={[member]} />);

    expect(screen.getByRole('columnheader', { name: 'Nombre' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Rol' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Estado' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Miembro desde' })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
  });

  it('renders the Spanish empty state', () => {
    render(<TeamMembersList members={[]} />);

    expect(screen.getByText('No hay miembros del equipo')).toBeInTheDocument();
    expect(
      screen.getByText('No se encontraron miembros para el tenant seleccionado.')
    ).toBeInTheDocument();
  });
});
