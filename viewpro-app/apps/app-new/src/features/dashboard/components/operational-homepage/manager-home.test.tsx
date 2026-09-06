import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { DashboardSummaryResponse } from '@/features/dashboard/api/types';
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

const useQueryMock = vi.mocked(useQuery);
const refetch = vi.fn();
const zeroSummary = {
  counters: { activeProperties: 0, attentionNeeded: 0, movementsInRange: 0, staleProperties: 0 },
  recentActivity: [],
  topProperties: [],
  topSellers: []
} as unknown as DashboardSummaryResponse;
const nonzeroSummary = {
  ...zeroSummary,
  counters: { activeProperties: 2, attentionNeeded: 3, movementsInRange: 5, staleProperties: 4 }
};

type ManagerQueryState = {
  data?: DashboardSummaryResponse;
  isError?: boolean;
  isFetching?: boolean;
  isLoading?: boolean;
  isSuccess?: boolean;
};

function setManagerQuery({
  data = zeroSummary,
  isError = false,
  isFetching = false,
  isLoading = false,
  isSuccess = true
}: ManagerQueryState = {}) {
  useQueryMock.mockReturnValue({
    data,
    isError,
    isFetching,
    isLoading,
    isSuccess,
    refetch
  } as never);
}

function expectMetric(label: string, value: number) {
  const metric = screen.getAllByText(label).find((element) => element.tagName === 'P');
  expect(metric).toBeDefined();
  expect(within(metric!.parentElement!).getByText(String(value))).toBeVisible();
}

describe('manager home query state', () => {
  it('uses exactly one initial summary query and omits the manager property preview while loading', () => {
    setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });

    render(<OperationalHomepage />);

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    expect(useQueryMock.mock.calls[0]?.[0]).toMatchObject({
      enabled: true,
      queryKey: ['dashboard', 'summary', 'tenant-1', '7d'],
      refetchOnReconnect: false,
      refetchOnWindowFocus: false
    });
        expect(screen.getByLabelText('Preparando resumen operativo')).toBeVisible();
        for (const label of [
          'Movimientos del período',
          'Propiedades activas',
          'Requieren atención',
          'Sin novedades en 7 días',
          'Sin movimientos recientes',
          'Sin actividad para comparar',
          'Sin movimientos de vendedores'
        ]) {
          expect(screen.queryByText(label)).not.toBeInTheDocument();
        }
    expect(screen.queryByRole('heading', { name: 'Gestiones para retomar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir listado' })).not.toBeInTheDocument();
  });

  it('shows all four successful zero metrics and real empty states', () => {
    setManagerQuery();

    render(<OperationalHomepage />);

    expectMetric('Movimientos del período', 0);
    expectMetric('Propiedades activas', 0);
    expectMetric('Requieren atención', 0);
    expectMetric('Sin novedades en 7 días', 0);
    expect(screen.getByText('Sin movimientos recientes')).toBeVisible();
    expect(screen.getByText('Sin actividad para comparar')).toBeVisible();
    expect(screen.getByText('Sin movimientos de vendedores')).toBeVisible();
  });

  it('hides retained facts on error and retries the summary exactly once', async () => {
    const user = userEvent.setup();
    setManagerQuery({ data: nonzeroSummary, isError: true, isSuccess: false });
    const homepage = render(<OperationalHomepage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Resumen operativo no disponible');
    expect(screen.queryByText('5')).not.toBeInTheDocument();

    setManagerQuery({ data: nonzeroSummary, isError: true, isFetching: true, isSuccess: false });
    homepage.rerender(<OperationalHomepage />);
    expect(screen.getByRole('button', { name: 'Reintentando resumen' })).toBeDisabled();

    setManagerQuery({ data: nonzeroSummary, isError: true, isSuccess: false });
    homepage.rerender(<OperationalHomepage />);
    await user.click(screen.getByRole('button', { name: 'Reintentar resumen' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('formats opposite sides of Buenos Aires midnight from a serializable millisecond seam', () => {
    expect(formatArgentinaCalendarDate(new Date('2026-05-25T02:59:00.000Z')).dateTime).toBe('2026-05-24');
    expect(formatArgentinaCalendarDate(new Date('2026-05-25T03:00:00.000Z')).dateTime).toBe('2026-05-25');

    const beforeMidnight = render(
      <OperationalHomepage nowMs={Date.parse('2026-05-25T02:59:00.000Z')} />
    );
    expect(beforeMidnight.container.querySelector('time')).toHaveAttribute('dateTime', '2026-05-24');
    beforeMidnight.unmount();

    const afterMidnight = render(
      <OperationalHomepage nowMs={Date.parse('2026-05-25T03:00:00.000Z')} />
    );
    expect(afterMidnight.container.querySelector('time')).toHaveAttribute('dateTime', '2026-05-25');
  });
});
