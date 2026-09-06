import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { formatArgentinaCalendarDate } from '../operational-homepage/helpers';
import { OperationalHomepage } from '../operational-homepage';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQuery: vi.fn(() => ({ data: undefined, isError: false, isLoading: true }))
  };
});

vi.mock('@/lib/session-context', () => ({
  useActiveTenant: vi.fn(() => ({
    activeMembership: {
      id: 'membership-1',
      permissions: ['engagements:view:all'],
      role: 'MANAGER',
      tenant: {
        id: 'tenant-1',
        name: 'Costa Norte Propiedades',
        slug: 'costa-norte',
        status: 'ACTIVE'
      }
    },
    activeTenantId: 'tenant-1',
    isTenantLoading: false
  })),
  useSession: vi.fn(() => ({
    session: {
      user: {
        email: 'patricio@example.com',
        emailVerifiedAt: '2026-05-25T00:00:00.000Z',
        firstName: 'Patricio',
        globalRole: 'USER',
        id: 'user-1',
        lastName: 'Gómez',
        status: 'ACTIVE'
      }
    }
  }))
}));

describe('manager home heading', () => {
  it('greets the authenticated manager instead of using a generic manager heading', () => {
    render(<OperationalHomepage />);

    expect(screen.getByRole('heading', { name: 'Hola, Patricio Gómez' })).toBeVisible();
    expect(vi.mocked(useQuery)).toHaveBeenCalled();
  });

  it('formats opposite sides of Buenos Aires midnight as their local calendar days', () => {
    expect(formatArgentinaCalendarDate(new Date('2026-05-25T02:59:00.000Z')).dateTime).toBe(
      '2026-05-24'
    );
    expect(formatArgentinaCalendarDate(new Date('2026-05-25T03:00:00.000Z')).dateTime).toBe(
      '2026-05-25'
    );

    const beforeMidnight = render(
      <OperationalHomepage now={() => new Date('2026-05-25T02:59:00.000Z')} />
    );
    expect(beforeMidnight.container.querySelector('time')).toHaveAttribute('dateTime', '2026-05-24');
    beforeMidnight.unmount();

    const afterMidnight = render(
      <OperationalHomepage now={() => new Date('2026-05-25T03:00:00.000Z')} />
    );
    expect(afterMidnight.container.querySelector('time')).toHaveAttribute('dateTime', '2026-05-25');
  });
});
