import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SellerActivityState, SellerProductsState } from './seller-home';
import { SellerActivityList, SellerPropertyList } from './seller-lists';
import { SellerHomeView, type SellerShortcut } from './seller-sections';

const products = { data: { items: [], total: 7 }, status: 'ready', tenantId: 'tenant-1' } as unknown as SellerProductsState;
const activity = {
  data: { counters: { attentionCount: 2, staleCount: 3, todayCount: 4 }, items: [] },
  status: 'ready',
  tenantId: 'tenant-1'
} as unknown as SellerActivityState;

function renderSeller({
  activityState = activity,
  productsState = products,
  shortcuts = [
    { href: '/dashboard/product', icon: 'product', label: 'Propiedades' },
    { href: '/dashboard/seguimiento', icon: 'trendingUp', label: 'Seguimiento' }
  ]
}: {
  activityState?: SellerActivityState;
  productsState?: SellerProductsState;
  shortcuts?: SellerShortcut[];
} = {}) {
  return render(
    <SellerHomeView
      activity={activityState}
      displayName='Martín Pérez'
      products={productsState}
      shortcuts={shortcuts}
      tenantName='Inmobiliaria del Río'
    />
  );
}

const forbiddenSummaryContent = [
  /tareas?|checklists?|fechas? límite|personas?|agenda|llamadas?|mensajes?|whatsapp|recordatorios?|visitas de hoy/i,
  /rendimiento|ranking|porcentajes?|comparaciones?|alertas?|bandeja|insignias?|notificaciones?|avatar|crear propiedad|movimiento global/i,
  /propuestas?|clientes?|contactos?|fotos?|cambios? de precio|acción documental|plataforma|operador|proveedor|manager|owner|#306|#327|navegación inferior/i
];
const forbiddenActionPattern = /^(crear|propuesta|editar|solicitar|movimiento global|actor|contacto|llamar|enviar mensaje|persona|resultado|visita|precio|foto|tarea|fecha límite|completar|agenda|whatsapp|recordatorio|rendimiento|performance|ranking|porcentaje|comparación|alerta|notificación|plataforma|operador|proveedor|manager|owner|#306|#327|navegación duplicada|navegación inferior)/i;

describe('SellerHomeView', () => {
  it('orders real identity, four owned facts, and two aggregate priorities without reference-only content', () => {
    renderSeller();

    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Martín Pérez' })).toBeVisible();
    expect(screen.getByText('Inmobiliaria del Río')).toBeVisible();
    expect(screen.getByText('Ventanas móviles · America/Argentina/Buenos_Aires')).toBeVisible();
    const facts = within(screen.getByRole('region', { name: 'Resumen de gestiones' }));
    expect(facts.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Mis gestiones asignadas'),
      expect.stringContaining('Movimientos en las últimas 24 horas'),
      expect.stringContaining('Requieren seguimiento'),
      expect.stringContaining('Sin movimientos en los últimos 7 días')
    ]);
    const priorities = within(screen.getByRole('region', { name: 'Prioridades' }));
    expect(priorities.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Requieren seguimiento: 2Último movimiento de consulta, visita completada u oferta recibida sin próximo paso informado.',
      'Sin movimientos en los últimos 7 días: 3Sin movimientos en la ventana móvil de los últimos 7 días.'
    ]);
    for (const forbidden of forbiddenSummaryContent) expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    expect(screen.queryByText(/hoy/i)).not.toBeInTheDocument();
    expect(priorities.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(priorities.queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps each confirmed sibling source visible while the unavailable owner stays local', () => {
    const activityFailure = renderSeller({ activityState: { retry: vi.fn(), retrying: false, status: 'error', tenantId: 'tenant-1' } });
    expect(screen.getByText('7')).toBeVisible();
    expect(screen.getByRole('alert', { name: 'Prioridades de actividad no disponible' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Reintentar prioridades de actividad' })).toBeVisible();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Prioridades' }).querySelector('ul')).toBeNull();
    activityFailure.unmount();

    renderSeller({ productsState: { retry: vi.fn(), retrying: false, status: 'error', tenantId: 'tenant-1' } });
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByRole('alert', { name: 'Mis gestiones asignadas no disponible' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Prioridades' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('preserves successful zero priorities and labels each refreshing priority value', () => {
    renderSeller({
      activityState: {
        data: { counters: { attentionCount: 0, staleCount: 0, todayCount: 0 }, items: [] },
        status: 'refreshing',
        tenantId: 'tenant-1'
      } as unknown as SellerActivityState
    });

    expect(screen.getAllByText('0')).toHaveLength(3);
    expect(screen.getAllByText('Actualizando…')).toHaveLength(6);
    expect(within(screen.getByRole('region', { name: 'Prioridades' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('labels each retained priority value without replacing confirmed counters', () => {
    renderSeller({
      activityState: {
        data: { counters: { attentionCount: 2, staleCount: 3, todayCount: 4 }, items: [] },
        retry: vi.fn(),
        retrying: false,
        status: 'retained-error',
        tenantId: 'tenant-1'
      } as unknown as SellerActivityState
    });

    expect(screen.getAllByText('Última información disponible')).toHaveLength(6);
    expect(screen.getByText('4')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Prioridades' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('keeps each retained list available with only its own retry', async () => {
    const productRetry = vi.fn();
    const activityRetry = vi.fn();
    const user = userEvent.setup();

    renderSeller({
      activityState: {
        ...sellerActivity([movementRow(1)]),
        retry: activityRetry,
        retrying: false,
        status: 'retained-error'
      },
      productsState: {
        ...sellerProducts([propertyRow(1)], 1),
        retry: productRetry,
        retrying: false,
        status: 'retained-error'
      }
    });

    expect(screen.getByText('Propiedad 1')).toBeVisible();
    expect(screen.getByText('Movimiento 1')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Reintentar propiedades asignadas' }));
    expect(productRetry).toHaveBeenCalledTimes(1);
    expect(activityRetry).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Reintentar actividad' }));
    expect(activityRetry).toHaveBeenCalledTimes(1);
  });

  it('composes the bounded seller lists and only property then follow-up shortcuts', () => {
    renderSeller({
      activityState: sellerActivity([movementRow(1)]),
      productsState: sellerProducts([propertyRow(1)], 1)
    });

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    ).toEqual([
      'Resumen de gestiones',
      'Prioridades',
      'Mis propiedades asignadas',
      'Actividad de mis propiedades',
      'Accesos rápidos'
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Mis propiedades' })).getByRole('link', {
        name: 'Abrir propiedad: Propiedad 1'
      })
    ).toHaveAttribute('href', '/dashboard/product/engagement-1');
    expect(
      within(screen.getByRole('region', { name: 'Actividad reciente' })).getByRole('link', {
        name: 'Abrir actividad: Propiedad 1'
      })
    ).toHaveAttribute('href', '/dashboard/product/engagement-1');
    expect(
      within(screen.getByRole('navigation', { name: 'Accesos rápidos' }))
        .getAllByRole('link')
        .map((link) => ({ href: link.getAttribute('href'), label: link.textContent }))
    ).toEqual([
      { href: '/dashboard/product', label: 'Propiedades' },
      { href: '/dashboard/seguimiento', label: 'Seguimiento' }
    ]);
  });

  it('keeps named semantic regions and owner retries in keyboard order', async () => {
    const user = userEvent.setup();
    const productRetry = vi.fn();
    const activityRetry = vi.fn();

    renderSeller({
      activityState: {
        ...sellerActivity([movementRow(1)]),
        retry: activityRetry,
        retrying: true,
        status: 'retained-error'
      },
      productsState: {
        ...sellerProducts([propertyRow(1)], 1),
        retry: productRetry,
        retrying: true,
        status: 'retained-error'
      }
    });

    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Martín Pérez' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Resumen de gestiones' })).getByRole('list', { name: 'Hechos del resumen' })).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Prioridades' })).getByRole('list', { name: 'Prioridades de seguimiento' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Accesos rápidos' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Reintentando / })).toHaveLength(2);
    for (const button of screen.getAllByRole('button', { name: /^Reintentando / })) {
      expect(button).toBeDisabled();
    }

    const priorities = within(screen.getByRole('region', { name: 'Prioridades' })).getAllByRole('link');
    expect(priorities.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Requieren seguimiento'),
      expect.stringContaining('Sin movimientos en los últimos 7 días')
    ]);
    await user.tab();
    expect(priorities[0]).toHaveFocus();
    await user.tab();
    expect(priorities[1]).toHaveFocus();
  });
});


function sellerProducts(items: unknown[], total: number): Extract<SellerProductsState, { status: 'ready' }> {
  return { data: { items, total }, status: 'ready', tenantId: 'tenant-1' } as Extract<SellerProductsState, { status: 'ready' }>;
}

function sellerActivity(items: unknown[]): Extract<SellerActivityState, { status: 'ready' }> {
  return {
    data: { counters: { attentionCount: 0, staleCount: 0, todayCount: 0 }, items },
    status: 'ready',
    tenantId: 'tenant-1'
  } as Extract<SellerActivityState, { status: 'ready' }>;
}

function propertyRow(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `engagement-${index}`,
    property: {
      addressLine: `Calle ${index}`,
      city: 'Rosario',
      province: 'Santa Fe',
      title: `Propiedad ${index}`
    },
    status: 'CAPTURE',
    tenantId: 'tenant-1',
    ...overrides
  };
}

function movementRow(index: number, overrides: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-09-08T09:00:00-03:00',
    id: `movement-${index}`,
    kind: 'movement',
    nextStep: null,
    observation: `Movimiento ${index}`,
    property: {
      addressLine: `Calle ${index}`,
      engagementId: `engagement-${index}`,
      title: `Propiedad ${index}`
    },
    propertyEngagementId: `engagement-${index}`,
    tenantId: 'tenant-1',
    type: 'INQUIRY',
    ...overrides
  };
}

describe('seller bounded list presenters', () => {
  it('keeps six assigned engagements in source order with truthful fields and only safe same-tenant links', () => {
    const rows = Array.from({ length: 7 }, (_, index) => propertyRow(index + 1));
    rows[1] = propertyRow(2, {
      id: '',
      property: { addressLine: ' ', city: '', province: '', title: ' ' }
    });
    rows[2] = propertyRow(3, { tenantId: 'tenant-2' });

    render(<SellerPropertyList state={sellerProducts(rows, 7)} />);

    const listRows = screen.getAllByRole('listitem');
    expect(listRows).toHaveLength(6);
    expect(listRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Propiedad 1'),
      expect.stringContaining('Propiedad sin título'),
      expect.stringContaining('Propiedad 3'),
      expect.stringContaining('Propiedad 4'),
      expect.stringContaining('Propiedad 5'),
      expect.stringContaining('Propiedad 6')
    ]);
    expect(screen.getByText('Dirección no informada')).toBeVisible();
    expect(screen.getAllByText('Captación')).toHaveLength(6);
    expect(screen.getByRole('link', { name: 'Abrir propiedad: Propiedad 1' })).toHaveAttribute('href', '/dashboard/product/engagement-1');
    expect(screen.queryByRole('link', { name: /Propiedad sin título|Propiedad 3/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(forbiddenActionPattern)).not.toBeInTheDocument();
    expect(screen.queryByText('Propiedad 7')).not.toBeInTheDocument();
  });

  it('distinguishes movement and document-request source prose, safe time, and unsafe activity data', () => {
    const longObservation = 'Una observación guardada con mensaje literal que conserva un detalle operativo muy extenso para demostrar que el presentador no recorta ni reinterpreta el texto autorizado de la actividad mientras permanece disponible para la persona que revisa esta gestión asignada.';
    const documentRequest = {
      createdAt: 'not-an-iso-date',
      documentRequest: { description: 'Copiar el texto guardado', title: 'Escritura' },
      id: 'document-2',
      kind: 'document_request',
      property: { addressLine: '', engagementId: ' invalid ', title: '' },
      propertyEngagementId: ' invalid ',
      tenantId: 'tenant-1'
    };
    const movements: Record<string, unknown>[] = Array.from({ length: 6 }, (_, index) => movementRow(index + 1));
    movements[0] = movementRow(1, { nextStep: 'Contactar sin reinterpretar', observation: longObservation });
    movements[1] = movementRow(2, { nextStep: ' ', tenantId: 'tenant-2' });
    movements[2] = movementRow(3, { observation: ' ' });
    movements[4] = {
      ...documentRequest,
      createdAt: ' ',
      documentRequest: { description: ' ', title: ' ' },
      id: 'document-blank'
    };
    const items = [movements[0], documentRequest, ...movements.slice(1)];

    render(<SellerActivityList state={sellerActivity(items)} />);

    const listRows = screen.getAllByRole('listitem');
    expect(listRows).toHaveLength(6);
    expect(listRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining(longObservation),
      expect.stringContaining('Solicitud documental'),
      expect.stringContaining('Movimiento 2'),
      expect.stringContaining('Observación no informada'),
      expect.stringContaining('Movimiento 4'),
      expect.stringContaining('Solicitud documental sin título')
    ]);
    expect(screen.getAllByText('Consulta')).toHaveLength(4);
    expect(screen.getByText('Próximo paso informado: Contactar sin reinterpretar')).toBeVisible();
    expect(screen.getByText('Descripción: Copiar el texto guardado')).toBeVisible();
    expect(screen.getAllByText('Fecha no disponible')).toHaveLength(2);
    expect(screen.getAllByRole('time')).toHaveLength(4);
    expect(within(listRows[1]).queryByRole('time')).not.toBeInTheDocument();
    expect(within(listRows[5]).queryByRole('time')).not.toBeInTheDocument();
    expect(screen.getAllByRole('time')[0]).toHaveAttribute('dateTime', '2026-09-08T12:00:00.000Z');
    expect(screen.getAllByRole('time')[0]).toHaveTextContent('8 de sept de 2026, 09:00 a. m.');
    expect(screen.getByText('Solicitud documental sin título')).toBeVisible();
    expect(screen.queryByText('Descripción:  ')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir actividad: Propiedad 1' })).toHaveAttribute('href', '/dashboard/product/engagement-1');
    expect(screen.queryByRole('link', { name: /Propiedad sin título|Propiedad 2/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Próximo paso informado:  ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(forbiddenActionPattern)).not.toBeInTheDocument();
    expect(screen.queryByText('Movimiento 6')).not.toBeInTheDocument();
  });

  it('separates successful empty previews from positive-total preview gaps and unavailable states', () => {
    const emptyProducts = render(<SellerPropertyList state={sellerProducts([], 0)} />);
    expect(screen.getByText('Sin propiedades asignadas')).toBeVisible();
    expect(screen.queryByText('No hay gestiones para mostrar en esta vista')).not.toBeInTheDocument();
    emptyProducts.unmount();

    const positiveTotalEmpty = render(<SellerPropertyList state={sellerProducts([], 2)} />);
    expect(screen.getByText('No hay gestiones para mostrar en esta vista')).toBeVisible();
    expect(screen.queryByText('Sin propiedades asignadas')).not.toBeInTheDocument();
    positiveTotalEmpty.unmount();

    const mixedAvailability = render(<><SellerPropertyList state={{ retry: vi.fn(), retrying: false, status: 'error', tenantId: 'tenant-1' }} /><SellerActivityList state={sellerActivity([])} /></>);
    expect(screen.getByText('Sin actividad reciente')).toBeVisible();
    expect(screen.queryByText('Sin propiedades asignadas')).not.toBeInTheDocument();
    mixedAvailability.unmount();

    render(<SellerActivityList state={{ retry: vi.fn(), retrying: false, status: 'error', tenantId: 'tenant-1' }} />);
    expect(screen.queryByText('Sin actividad reciente')).not.toBeInTheDocument();
  });
});
