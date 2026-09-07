import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardSummaryResponse } from '@/features/dashboard/api/types';
import { useActiveTenant } from '@/lib/session-context';
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
  useActiveTenant: vi.fn(),
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
type TenantContext = ReturnType<typeof useActiveTenant>;

function managerTenantContext(id: string, name: string, slug: string): TenantContext {
  return {
    activeMembership: {
      id: `membership-${id}`,
      permissions: ['engagements:view:all'],
      role: 'MANAGER',
      tenant: { id, name, slug, status: 'ACTIVE' }
    },
    activeTenantId: id,
    isTenantLoading: false
  } as TenantContext;
}

const primaryTenantContext = managerTenantContext(
  'tenant-1',
  'Costa Norte Propiedades',
  'costa-norte'
);
const secondaryTenantContext = managerTenantContext(
  'tenant-2',
  'Río Plata Inmobiliaria',
  'rio-plata'
);
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

function expectLatestSummaryQuery(tenantId: string, range: '7d' | '14d' | '30d') {
  const options = useQueryMock.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>;

  expect(Object.keys(options).toSorted()).toEqual([
    'enabled',
    'queryFn',
    'queryKey',
    'refetchOnReconnect',
    'refetchOnWindowFocus'
  ]);
  expect(options).toMatchObject({
    enabled: true,
    queryKey: ['dashboard', 'summary', tenantId, range],
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  expect(options.queryFn).toEqual(expect.any(Function));
}

function expectNoSummaryFacts() {
  for (const label of [
    'Movimientos del período',
    'Propiedades activas',
    'Requieren atención',
    'Sin novedades en 7 días',
    'Sin novedades en 14 días',
    'Sin novedades en 30 días',
    'Sin movimientos recientes',
    'Sin actividad para comparar',
    'Sin movimientos de vendedores'
  ]) {
    expect(screen.queryByText(label)).not.toBeInTheDocument();
  }
}

describe('manager home query state', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
    refetch.mockClear();
    vi.mocked(useActiveTenant).mockReturnValue(primaryTenantContext);
  });

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
    setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
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

  it('keeps successful ready counters and true empty facts while the summary refreshes', () => {
    setManagerQuery({ data: nonzeroSummary, isFetching: true });

    render(<OperationalHomepage />);

    expectMetric('Movimientos del período', 5);
    expectMetric('Propiedades activas', 2);
    expectMetric('Requieren atención', 3);
    expectMetric('Sin novedades en 7 días', 4);
    expect(screen.getByText('Sin movimientos recientes')).toBeVisible();
    expect(screen.getByText('Sin actividad para comparar')).toBeVisible();
    expect(screen.getByText('Sin movimientos de vendedores')).toBeVisible();
    expectLatestSummaryQuery('tenant-1', '7d');
  });

  it('clears prior facts during each range transition and uses the current range query', async () => {
    const user = userEvent.setup();
    setManagerQuery({ data: nonzeroSummary });
    const homepage = render(<OperationalHomepage />);
    expectLatestSummaryQuery('tenant-1', '7d');

    setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
    await user.click(screen.getByRole('button', { name: '14 días' }));
    expect(screen.getByLabelText('Preparando resumen operativo')).toBeVisible();
    expectNoSummaryFacts();
    expectLatestSummaryQuery('tenant-1', '14d');

    setManagerQuery({ data: nonzeroSummary });
    homepage.rerender(<OperationalHomepage />);
    expectMetric('Movimientos del período', 5);
    expectLatestSummaryQuery('tenant-1', '14d');

    setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
    await user.click(screen.getByRole('button', { name: '30 días' }));
    expect(screen.getByLabelText('Preparando resumen operativo')).toBeVisible();
    expectNoSummaryFacts();
    expectLatestSummaryQuery('tenant-1', '30d');

    setManagerQuery({ data: nonzeroSummary });
    homepage.rerender(<OperationalHomepage />);
    expectMetric('Movimientos del período', 5);
    expectLatestSummaryQuery('tenant-1', '30d');
  });

  it('clears tenant-one facts before querying the current range for a second membership', () => {
    const tenantContext = vi.mocked(useActiveTenant);
    setManagerQuery({ data: nonzeroSummary });
    const homepage = render(<OperationalHomepage />);
    expectMetric('Movimientos del período', 5);

    tenantContext.mockReturnValue(secondaryTenantContext);
    setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
    homepage.rerender(<OperationalHomepage />);

    expect(screen.getByLabelText('Preparando resumen operativo')).toBeVisible();
    expectNoSummaryFacts();
    expectLatestSummaryQuery('tenant-2', '7d');

    setManagerQuery({ data: nonzeroSummary });
    homepage.rerender(<OperationalHomepage />);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' && element.textContent?.includes('Río Plata Inmobiliaria') === true
      )
    ).toBeVisible();
    expectMetric('Movimientos del período', 5);
    expectLatestSummaryQuery('tenant-2', '7d');
  });
});
