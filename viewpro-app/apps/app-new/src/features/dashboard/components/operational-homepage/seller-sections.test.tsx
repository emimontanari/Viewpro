import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SellerActivityState, SellerProductsState } from './seller-home';
import { SellerHomeView } from './seller-sections';

const products = { data: { items: [], total: 7 }, status: 'ready', tenantId: 'tenant-1' } as unknown as SellerProductsState;
const activity = {
  data: { counters: { attentionCount: 2, staleCount: 3, todayCount: 4 }, items: [] },
  status: 'ready',
  tenantId: 'tenant-1'
} as unknown as SellerActivityState;

function renderSeller({
  activityState = activity,
  productsState = products
}: {
  activityState?: SellerActivityState;
  productsState?: SellerProductsState;
} = {}) {
  return render(
    <SellerHomeView
      activity={activityState}
      displayName='Martín Pérez'
      products={productsState}
      tenantName='Inmobiliaria del Río'
    />
  );
}

const forbiddenSummaryContent = [
  /tareas?|checklists?|fechas? límite|personas?|agenda|llamadas?|mensajes?|whatsapp|recordatorios?|visitas de hoy/i,
  /rendimiento|ranking|porcentajes?|comparaciones?|alertas?|bandeja|insignias?|notificaciones?|avatar|crear propiedad|movimiento global/i,
  /propuestas?|clientes?|contactos?|fotos?|cambios? de precio|acción documental|plataforma|operador|proveedor|manager|owner|#306|#327|navegación inferior/i
];

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
    expect(screen.getAllByText('Actualizando…')).toHaveLength(5);
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

    expect(screen.getAllByText('Última información disponible')).toHaveLength(5);
    expect(screen.getByText('4')).toBeVisible();
    expect(within(screen.getByRole('region', { name: 'Prioridades' })).getAllByRole('listitem')).toHaveLength(2);
  });
});
