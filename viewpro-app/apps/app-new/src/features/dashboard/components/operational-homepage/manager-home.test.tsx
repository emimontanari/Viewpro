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

function managerTenantContext(
  id: string,
  name: string,
  slug: string,
  permissions = ['engagements:view:all']
): TenantContext {
  return {
    activeMembership: {
      id: `membership-${id}`,
      permissions,
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
    const propertySummary = {
      ...nonzeroSummary,
      topProperties: [
        {
          addressLine: 'Avenida Siempre Viva 123',
          documentRequestCount: 2,
          engagementId: 'engagement-property-1',
          lastActivityAt: '2026-05-25T03:00:00.000Z',
          lastActivityTitle: 'Escritura pendiente',
          movementCount: 4,
          title: 'Casa con jardín'
        },
        {
          addressLine: 'Calle 8 456',
          documentRequestCount: 0,
          engagementId: 'engagement-property-2',
          lastActivityAt: '2026-05-25T04:00:00.000Z',
          lastActivityTitle: 'Nueva consulta',
          movementCount: 2,
          title: null
        }
      ]
    } as unknown as DashboardSummaryResponse;
    const sellerSummary = {
      ...nonzeroSummary,
      topSellers: [
        { email: 'ana@example.com', lastMovementAt: '2026-05-25T03:00:00.000Z', movementCount: 4, name: 'Ana Pérez', touchedPropertiesCount: 2, userId: 'seller-ana' },
        { email: 'bruno@example.com', lastMovementAt: '2026-05-25T04:00:00.000Z', movementCount: 3, name: 'Bruno Díaz', touchedPropertiesCount: 1, userId: 'seller-bruno' },
        { email: 'carla@example.com', lastMovementAt: '2026-05-25T05:00:00.000Z', movementCount: 2, name: 'Carla Ruiz', touchedPropertiesCount: 2, userId: 'seller-carla' },
        { email: 'diego@example.com', lastMovementAt: '2026-05-25T06:00:00.000Z', movementCount: 1, name: 'Diego Soto', touchedPropertiesCount: 1, userId: 'seller-diego' }
      ]
    } as unknown as DashboardSummaryResponse;
    const activitySummary = {
      ...propertySummary,
      recentActivity: [
        {
          createdAt: '2026-05-25T03:00:00.000Z',
          id: 'movement-1',
          kind: 'movement',
          observation: 'Recibimos una consulta concreta',
          property: {
            addressLine: 'Avenida Siempre Viva 123',
            engagementId: 'engagement-1',
            title: 'Casa con jardín'
          }
        },
        {
          createdAt: '2026-05-25T04:00:00.000Z',
          documentRequest: { title: 'Escritura pendiente' },
          id: 'document-1',
          kind: 'document_request',
          property: { addressLine: null, engagementId: 'engagement-2', title: 'Departamento centro' }
        }
      ]
    } as unknown as DashboardSummaryResponse;

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

function getTopPropertiesSection() {
  return screen.getByRole('heading', { level: 2, name: 'Propiedades con más movimiento' }).parentElement!
    .parentElement!.parentElement!;
}

function getTopSellersSection() {
  return screen.getByRole('heading', { level: 2, name: 'Vendedores con más movimiento' }).parentElement!
    .parentElement!.parentElement!;
}

function getShortcutsSection() {
  return screen.getByRole('heading', { level: 2, name: 'Accesos directos' }).closest('[data-slot="card"]') as HTMLElement;
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
      expect(
        within(screen.getByRole('alert')).getByRole('button', { name: 'Reintentando resumen' })
      ).toBeDisabled();

      setManagerQuery({ data: nonzeroSummary, isError: true, isSuccess: false });
      homepage.rerender(<OperationalHomepage />);
      await user.click(
        within(screen.getByRole('alert')).getByRole('button', { name: 'Reintentar resumen' })
      );
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

    it('renders bounded truthful recent activity with Buenos Aires timestamps and engagement links', () => {
      setManagerQuery({ data: activitySummary });

      render(<OperationalHomepage />);

      const activity = screen.getByRole('heading', { level: 2, name: 'Actividad reciente' }).parentElement!
        .parentElement!.parentElement!;
      expect(within(activity).getByText('Movimiento')).toBeVisible();
      expect(within(activity).getByText('Recibimos una consulta concreta')).toBeVisible();
      expect(within(activity).getByText('Casa con jardín')).toBeVisible();
      expect(within(activity).getByText('Documento')).toBeVisible();
      expect(within(activity).getByText('Escritura pendiente')).toBeVisible();
      expect(within(activity).getByRole('link', { name: 'Abrir actividad: Recibimos una consulta concreta' })).toHaveAttribute(
        'href',
        '/dashboard/product/engagement-1'
      );
      expect(activity.querySelector('time')).toHaveAttribute('dateTime', '2026-05-25T03:00:00.000Z');
      expect(within(activity).getByText('25 de may de 2026, 12:00 a. m.')).toBeVisible();
    });

    it('bounds activity without reordering, keeps long text readable, and fails closed on an invalid destination', () => {
      const longTitle = 'Actividad extensa para comprobar que el contenido real sigue disponible sin recortes';
      const boundedActivity = Array.from({ length: 6 }, (_, index) => ({
        createdAt: '2026-05-25T03:00:00.000Z',
        id: `movement-${index + 1}`,
        kind: 'movement',
        observation: index === 0 ? longTitle : `Movimiento ${index + 1}`,
        property: {
          addressLine: null,
          engagementId: index === 0 ? 'invalid/id' : index === 1 ? '' : `engagement-${index + 1}`,
          title: index === 0 ? `${longTitle} de propiedad` : `Propiedad ${index + 1}`
        }
      }));
      setManagerQuery({
        data: { ...activitySummary, recentActivity: boundedActivity } as DashboardSummaryResponse
      });

      render(<OperationalHomepage />);

      const activity = screen.getByRole('heading', { level: 2, name: 'Actividad reciente' }).parentElement!
        .parentElement!.parentElement!;
      const rows = within(activity).getByRole('list').children;
      expect(rows).toHaveLength(5);
      expect(rows[0]).toHaveTextContent(longTitle);
      expect(rows[1]).toHaveTextContent('Movimiento 2');
      expect(within(activity).queryByText('Movimiento 6')).not.toBeInTheDocument();
      expect(within(activity).queryByRole('link', { name: `Abrir actividad: ${longTitle}` })).not.toBeInTheDocument();
      expect(within(activity).queryByRole('link', { name: 'Abrir actividad: Movimiento 2' })).not.toBeInTheDocument();
    });

    it.each(['7d', '14d', '30d'] as const)(
      'identifies %s property rankings and renders their real source facts and destinations',
      async (range) => {
        const user = userEvent.setup();
        setManagerQuery({ data: propertySummary });
        render(<OperationalHomepage />);

        await user.click(screen.getByRole('button', { name: `${range.replace('d', '')} días` }));

        const properties = screen.getByRole('heading', { level: 2, name: 'Propiedades con más movimiento' })
          .parentElement!.parentElement!.parentElement!;
        expect(within(properties).getByText(`Ranking por movimientos y solicitudes documentales de los últimos ${range.replace('d', '')} días.`)).toBeVisible();
        expect(within(properties).getByText(`Últimos ${range.replace('d', '')} días`)).toBeVisible();
        expect(within(properties).getByText('Casa con jardín')).toBeVisible();
        expect(within(properties).getByText('4 movimientos · 2 documentos')).toBeVisible();
        expect(within(properties).getByText('Último: Escritura pendiente')).toBeVisible();
        expect(within(properties).getByRole('link', { name: 'Abrir propiedad Casa con jardín' })).toHaveAttribute(
          'href',
          '/dashboard/product/engagement-property-1'
        );
        expect(properties.querySelector('time')).toHaveAttribute('dateTime', '2026-05-25T03:00:00.000Z');
        expect(within(properties).getByText('25 de may de 2026, 12:00 a. m.')).toBeVisible();
        expect(within(properties).getByText('Calle 8 456')).toBeVisible();
      }
    );

    it('bounds property rows in source order, keeps long fallbacks readable, and fails closed on malformed destinations', () => {
      const longAddress = 'Avenida muy extensa con un nombre real que debe mantenerse visible sin recortes';
      const topProperties = Array.from({ length: 4 }, (_, index) => ({
        addressLine: index === 0 ? longAddress : `Calle ${index + 1}`,
        documentRequestCount: index,
        engagementId: index === 0 ? 'invalid/id' : `engagement-property-${index + 1}`,
        lastActivityAt: '2026-05-25T03:00:00.000Z',
        lastActivityTitle: `Actividad ${index + 1}`,
        movementCount: index + 1,
        title: index === 0 ? null : `Propiedad ${index + 1}`
      }));
      setManagerQuery({ data: { ...propertySummary, topProperties } as DashboardSummaryResponse });

      render(<OperationalHomepage />);

      const properties = screen.getByRole('heading', { level: 2, name: 'Propiedades con más movimiento' })
        .parentElement!.parentElement!.parentElement!;
      const rows = within(properties).getByRole('list').children;
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveTextContent(longAddress);
      expect(rows[1]).toHaveTextContent('Propiedad 2');
      expect(within(properties).queryByText('Propiedad 4')).not.toBeInTheDocument();
      expect(within(properties).queryByRole('link', { name: `Abrir propiedad ${longAddress}` })).not.toBeInTheDocument();
    });

    it('distinguishes the property loading, empty, and unavailable states with an atomic panel retry', async () => {
      const user = userEvent.setup();
      setManagerQuery();
      const homepage = render(<OperationalHomepage />);
      expect(within(getTopPropertiesSection()).getByText('Sin actividad para comparar')).toBeVisible();

      setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
      homepage.rerender(<OperationalHomepage />);
      expect(within(getTopPropertiesSection()).getByLabelText('Cargando propiedades')).toBeVisible();
      expect(within(getTopPropertiesSection()).queryByText('Sin actividad para comparar')).not.toBeInTheDocument();

      setManagerQuery({ data: undefined, isError: true, isFetching: true, isSuccess: false });
      homepage.rerender(<OperationalHomepage />);
      expect(within(getTopPropertiesSection()).getByText('Propiedades con más movimiento no disponibles')).toBeVisible();
      expect(within(getTopPropertiesSection()).getByRole('button', { name: 'Reintentando propiedades' })).toBeDisabled();

      setManagerQuery({ data: undefined, isError: true, isSuccess: false });
      homepage.rerender(<OperationalHomepage />);
      await user.click(within(getTopPropertiesSection()).getByRole('button', { name: 'Reintentar propiedades' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it.each(['7d', '14d', '30d'] as const)('uses %s activity context and distinguishes empty, loading, and unavailable states', async (range) => {
      const user = userEvent.setup();
      setManagerQuery();
      const homepage = render(<OperationalHomepage />);
      await user.click(screen.getByRole('button', { name: `${range.replace('d', '')} días` }));
      expect(screen.getByText(`Movimientos y solicitudes documentales de los últimos ${range.replace('d', '')} días.`)).toBeVisible();
      expect(screen.getByText('Sin movimientos recientes')).toBeVisible();

      setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
      homepage.rerender(<OperationalHomepage />);
      expect(screen.getByLabelText('Cargando resumen operativo')).toBeVisible();
      expect(screen.queryByText('Sin movimientos recientes')).not.toBeInTheDocument();
    });

    it('retries the unavailable activity panel once and disables its atomic summary action while retrying', async () => {
      const user = userEvent.setup();
      setManagerQuery({ data: undefined, isError: true, isFetching: true, isSuccess: false });
      const homepage = render(<OperationalHomepage />);
      const activity = screen.getByRole('heading', { level: 2, name: 'Actividad reciente' }).parentElement!
        .parentElement!.parentElement!;
      expect(within(activity).getByText('Actividad reciente no disponible')).toBeVisible();
      expect(within(activity).getByRole('button', { name: 'Reintentando resumen' })).toBeDisabled();

      setManagerQuery({ data: undefined, isError: true, isSuccess: false });
      homepage.rerender(<OperationalHomepage />);
      await user.click(within(activity).getByRole('button', { name: 'Reintentar resumen' }));
      expect(refetch).toHaveBeenCalledTimes(1);
    });

        it('renders three truthful sellers with encoded follow-up links and no reference-only content', () => {
          setManagerQuery({ data: sellerSummary });

          render(<OperationalHomepage />);

          const sellers = getTopSellersSection();
          expect(within(sellers).getByRole('list').children).toHaveLength(3);
          expect(within(sellers).getByText('Ana Pérez')).toBeVisible();
          expect(within(sellers).getByText('ana@example.com')).toBeVisible();
          expect(within(sellers).getByText('4 movimientos manuales · 2 gestiones con movimiento')).toBeVisible();
          expect(within(sellers).getByText('25 de may de 2026, 12:00 a. m.')).toBeVisible();
          expect(within(sellers).getByRole('link', { name: 'Ver movimientos de Ana Pérez' })).toHaveAttribute(
            'href',
            '/dashboard/seguimiento?sellerId=seller-ana'
          );
          expect(within(sellers).queryByText('Diego Soto')).not.toBeInTheDocument();
          expect(document.body.textContent).not.toMatch(/puntaje|calificación|trofeo|foto|rendimiento|variación|%|visitas de hoy|alertas|mensajes|clientes|agenda|subir|recordatorio|notificaciones|propuesta|sincronización|proveedor|salud|operador/i);
        });

        it('shows only navigation-policy and creation-capability shortcuts', () => {
          vi.mocked(useActiveTenant).mockReturnValue(
            managerTenantContext('tenant-1', 'Costa Norte Propiedades', 'costa-norte', [
              'engagements.create',
              'engagements:view:all',
              'team.view'
            ])
          );
          setManagerQuery({ data: sellerSummary });
          const homepage = render(<OperationalHomepage />);

          const allowed = getShortcutsSection();
          expect(within(allowed).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
            '/dashboard/product',
            '/dashboard/seguimiento',
            '/dashboard/users',
            '/dashboard/product/new'
          ]);

          vi.mocked(useActiveTenant).mockReturnValue(primaryTenantContext);
          homepage.rerender(<OperationalHomepage />);
          const denied = getShortcutsSection();
          expect(within(denied).queryByRole('link', { name: 'Ver equipo' })).not.toBeInTheDocument();
          expect(within(denied).queryByRole('link', { name: 'Nueva propiedad' })).not.toBeInTheDocument();
        });

        it('distinguishes seller empty, loading, unavailable, retrying, and invalid-ID states', async () => {
          const user = userEvent.setup();
          setManagerQuery();
          const homepage = render(<OperationalHomepage />);
          expect(within(getTopSellersSection()).getByText('Sin movimientos de vendedores')).toBeVisible();

          setManagerQuery({ data: undefined, isLoading: true, isSuccess: false });
          homepage.rerender(<OperationalHomepage />);
          expect(within(getTopSellersSection()).getByLabelText('Cargando vendedores')).toBeVisible();

          setManagerQuery({ data: undefined, isError: true, isFetching: true, isSuccess: false });
          homepage.rerender(<OperationalHomepage />);
          expect(within(getTopSellersSection()).getByRole('button', { name: 'Reintentando vendedores' })).toBeDisabled();

          setManagerQuery({ data: undefined, isError: true, isSuccess: false });
          homepage.rerender(<OperationalHomepage />);
          await user.click(within(getTopSellersSection()).getByRole('button', { name: 'Reintentar vendedores' }));
          expect(refetch).toHaveBeenCalledTimes(1);

          setManagerQuery({ data: { ...sellerSummary, topSellers: [{ ...sellerSummary.topSellers[0], name: '', userId: 'invalid/id' }] } });
          homepage.rerender(<OperationalHomepage />);
          expect(within(getTopSellersSection()).getByText('ana@example.com')).toBeVisible();
          expect(within(getTopSellersSection()).queryByRole('link', { name: /Ana Pérez|ana@example.com/ })).not.toBeInTheDocument();
        });

        it('keeps policy-backed shortcuts visible through summary failure', () => {
          vi.mocked(useActiveTenant).mockReturnValue(
            managerTenantContext('tenant-1', 'Costa Norte Propiedades', 'costa-norte', ['team.view'])
          );
          setManagerQuery({ data: undefined, isError: true, isSuccess: false });

          render(<OperationalHomepage />);

          expect(screen.getByText('Vendedores con más movimiento no disponibles')).toBeVisible();
          expect(within(getShortcutsSection()).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
            '/dashboard/product',
            '/dashboard/seguimiento',
            '/dashboard/users'
          ]);
          expect(within(getShortcutsSection()).queryByRole('link', { name: 'Nueva propiedad' })).not.toBeInTheDocument();
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

});
