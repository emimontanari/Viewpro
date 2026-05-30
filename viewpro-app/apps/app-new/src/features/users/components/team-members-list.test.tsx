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
  it('renders real team member fields without CRUD actions', () => {
    render(<TeamMembersList members={[member]} />);

    expect(screen.getByText('Ana Gómez')).toBeVisible();
    expect(screen.getByText('ana@example.com')).toBeVisible();
    expect(screen.getByText('MANAGER')).toBeVisible();
    expect(screen.getByText('ACTIVE')).toBeVisible();
    expect(screen.getByText('May 1, 2026')).toBeVisible();

    expect(
      screen.queryByRole('button', { name: /add|create|edit|update|delete|remove/i })
    ).not.toBeInTheDocument();
  });

  it('renders an empty state', () => {
    render(<TeamMembersList members={[]} />);

    expect(screen.getByRole('heading', { name: 'No team members' })).toBeVisible();
    expect(
      screen.getByText('No team members were returned for the selected tenant.')
    ).toBeVisible();
  });
});
