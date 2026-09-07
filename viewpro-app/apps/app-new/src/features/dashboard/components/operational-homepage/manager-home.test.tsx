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
const movementWithEngagement = (engagementId: string, observation: string) =>
  ({
createdAt: '2026-05-25T02:30:00.000Z',
id: observation,
kind: 'movement',
nextStep: null,
observation,
property: { addressLine: null, engagementId, title: observation }
  }) as DashboardSummaryResponse['recentActivity'][number];
const propertyWithEngagement = (engagementId: string, title: string) =>
  ({
addressLine: null,
documentRequestCount: 0,
engagementId,
lastActivityAt: '2026-05-25T02:30:00.000Z',
lastActivityTitle: title,
movementCount: 1,
title
  }) as DashboardSummaryResponse['topProperties'][number];

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

function expectDocumentOrder(...elements: HTMLElement[]) {
  for (let index = 1; index < elements.length; index += 1) {
    expect(elements[index - 1]!.compareDocumentPosition(elements[index]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

  it('renders the complete manager hierarchy with four metrics and two distinct follow-ups', async () => {
    const user = userEvent.setup();
    setManagerQuery({ data: nonzeroSummary });
    const { container } = render(<OperationalHomepage />);
    await user.click(screen.getByRole('button', { name: '14 días' }));

    const greeting = screen.getByRole('heading', { level: 1, name: 'Hola, Patricio Gómez' });
    const date = container.querySelector('time')!;
    const summary = screen.getByRole('heading', { level: 2, name: 'Resumen operativo' });
    const range = screen.getByRole('group', { name: 'Período del resumen operativo' });
    const metrics = screen.getByRole('list', { name: 'Métricas del resumen operativo' });
    const labels = ['Propiedades activas', 'Movimientos del período', 'Sin novedades en 14 días', 'Requieren atención'];
    const priorities = screen.getByRole('heading', { level: 2, name: 'Prioridades' });
    expectDocumentOrder(greeting, date, summary, range, ...labels.map((label) => within(metrics).getByText(label)), priorities);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).slice(0, 2).map(({ textContent }) => textContent)).toEqual(['Resumen operativo', 'Prioridades']);
    expect(within(metrics).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.queryAllByRole('link', { name: /^(Ver seguimiento|Nueva propiedad|Ver propiedades)$/ }).every((link) => !(date.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING && link.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);

    const rows = within(priorities.parentElement!.parentElement!).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/dashboard/seguimiento', '/dashboard/seguimiento']);
    expect(rows[0]).toHaveTextContent('Sin novedades en 14 días');
    expect(rows[1]).toHaveTextContent('Requieren atención');
    expect(rows[0]).not.toHaveTextContent('Requieren atención');
    expect(rows[1]).not.toHaveTextContent('Sin novedades');
    expect(document.body.textContent).not.toMatch(/puntaje|calificación|trofeo|visitas de hoy|alertas|variación|mensajes enviados|%/i);
  });

  it.each(['7d', '14d', '30d'] as const)('renders %s labels, helpers, and zero-success copy', async (range) => {
    const user = userEvent.setup();
    setManagerQuery();
    render(<OperationalHomepage />);
    await user.click(screen.getByRole('button', { name: `${range.replace('d', '')} días` }));
    const days = range.replace('d', '');

    expect(screen.getByText(`0 gestiones activas y 0 movimientos en los últimos ${days} días.`)).toBeVisible();
    for (const expectedCopy of ['Gestiones activas, sin archivar y sin cerrar ni cancelar.', `Movimientos creados en gestiones activas durante los últimos ${days} días.`, `Gestiones activas sin movimientos creados en los últimos ${days} días.`, `Sin novedades en ${days} días`, 'Gestiones activas cuya última consulta, visita completada u oferta recibida del período no tiene próximo paso significativo.', `No hubo movimientos en los últimos ${days} días.`, `No hay gestiones sin novedades en ${days} días.`, 'No hay gestiones activas en este resumen.', 'No hay gestiones que requieran atención.']) expect(expectedCopy === `Sin novedades en ${days} días` ? within(screen.getByRole('list', { name: 'Métricas del resumen operativo' })).getByText(expectedCopy) : screen.getByText(expectedCopy)).toBeVisible();
    });

  it('renders bounded real activity and top-property records with Argentina-local source times', () => {
    const longActivity = 'Movimiento con una observación extensa que debe seguir siendo completamente legible sin perder información operativa.';
    const longProperty = 'Propiedad con un nombre excepcionalmente largo que debe seguir siendo completamente legible para la inmobiliaria.';
    const activity = (id: string, kind: 'movement' | 'document_request') =>
      ({
        createdAt: '2026-05-25T02:30:00.000Z',
        id,
        kind,
        observation: longActivity,
        property: {
          addressLine: 'Avenida Siempre Viva 742, Ciudad Autónoma de Buenos Aires',
          engagementId: `engagement-${id}`,
          title: longProperty
        },
        ...(kind === 'document_request'
          ? { documentRequest: { title: 'Escritura del inmueble' } }
          : { nextStep: null })
      }) as DashboardSummaryResponse['recentActivity'][number];
    const topProperty = (index: number) =>
      ({
        addressLine: `Dirección ${index}`,
        documentRequestCount: index,
        engagementId: `engagement-property-${index}`,
        lastActivityAt: '2026-05-25T02:30:00.000Z',
        lastActivityTitle: `Última actividad ${index}`,
        movementCount: index + 1,
        title: index === 1 ? null : `${longProperty} ${index}`
      }) as DashboardSummaryResponse['topProperties'][number];

    setManagerQuery({
      data: {
        ...nonzeroSummary,
        recentActivity: [
          activity('1', 'movement'),
          activity('2', 'document_request'),
          activity('3', 'movement'),
          activity('4', 'movement'),
          activity('5', 'movement'),
          activity('6', 'movement')
        ],
        topProperties: [topProperty(1), topProperty(2), topProperty(3), topProperty(4)]
      } as DashboardSummaryResponse
    });

    const { container } = render(<OperationalHomepage />);

    const recentActivity = screen.getByRole('list', { name: 'Actividad reciente' });
    expect(within(recentActivity).getAllByRole('listitem')).toHaveLength(5);
    expect(within(recentActivity).getAllByText('Movimiento')).toHaveLength(4);
    expect(within(recentActivity).getByText('Documento')).toBeVisible();
    expect(within(recentActivity).getAllByText(longActivity)).toHaveLength(4);
    expect(within(recentActivity).getAllByText(longProperty)).toHaveLength(4);
    expect(within(recentActivity).getAllByText('24 de may de 2026, 23:30')).toHaveLength(5);
    expect(container.querySelector('time[dateTime="2026-05-25T02:30:00.000Z"]')).toBeVisible();
    expect(within(recentActivity).getAllByRole('link', { name: /abrir actividad/i })[0]).toHaveAttribute(
      'href',
      '/dashboard/product/engagement-1'
    );

    const topProperties = screen.getByRole('list', { name: 'Propiedades con más movimiento' });
    expect(within(topProperties).getAllByRole('listitem')).toHaveLength(3);
    expect(within(topProperties).getByText('Dirección 1')).toBeVisible();
    expect(within(topProperties).getByText('2 movimientos · 1 documento')).toBeVisible();
    expect(within(topProperties).getByText('Último: Última actividad 1')).toBeVisible();
    expect(within(topProperties).getAllByText('24 de may de 2026, 23:30')).toHaveLength(3);
    expect(container.querySelectorAll('time[dateTime="2026-05-25T02:30:00.000Z"]')).toHaveLength(8);
    expect(within(topProperties).getAllByRole('link', { name: /abrir propiedad/i })[0]).toHaveAttribute(
      'href',
      '/dashboard/product/engagement-property-1'
    );
    expect(document.body.textContent).not.toMatch(/puntaje|rendimiento|variación|porcentaje|%/i);
  });

      it('keeps real destinations fail-closed for blank or malformed engagement identifiers', () => {
        setManagerQuery({
          data: {
            ...zeroSummary,
            recentActivity: [
              movementWithEngagement('engagement-valid', 'Actividad válida'),
              movementWithEngagement('bad/path', 'Actividad inválida')
            ],
            topProperties: [
              propertyWithEngagement('engagement-valid', 'Propiedad válida'),
              propertyWithEngagement(' ', 'Propiedad inválida')
            ]
          } as DashboardSummaryResponse
        });
    render(<OperationalHomepage />);

    expect(screen.getByRole('link', { name: 'Abrir actividad: Actividad válida' })).toHaveAttribute('href', '/dashboard/product/engagement-valid');
    expect(within(screen.getAllByText('Actividad inválida')[0].closest('li')!).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir propiedad Propiedad válida' })).toHaveAttribute('href', '/dashboard/product/engagement-valid');
    expect(within(screen.getByText('Propiedad inválida').closest('li')!).queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps ready-empty ranking copy distinct from summary-unavailable panels', () => {
    setManagerQuery();
    const homepage = render(<OperationalHomepage />);
    expect(screen.getByText('Sin movimientos recientes')).toBeVisible();
    expect(screen.getByText('Sin actividad para comparar')).toBeVisible();

    setManagerQuery({ data: nonzeroSummary, isError: true, isSuccess: false });
    homepage.rerender(<OperationalHomepage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Resumen operativo no disponible');
    expect(screen.getByText('Actividad reciente no disponible')).toBeVisible();
    expect(screen.getByText('Propiedades con más movimiento no disponibles')).toBeVisible();
    expect(screen.queryByText('Sin movimientos recientes')).not.toBeInTheDocument();
    expect(screen.queryByText('Sin actividad para comparar')).not.toBeInTheDocument();
  });
});
