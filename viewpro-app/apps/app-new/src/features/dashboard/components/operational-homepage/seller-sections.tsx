import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SellerActivityState, SellerProductsState } from './seller-home';

type SellerHomeViewProps = {
  activity: SellerActivityState;
  displayName: string;
  products: SellerProductsState;
  tenantName: string;
};

type SellerState = SellerProductsState | SellerActivityState;

export function SellerHomeView({ activity, displayName, products, tenantName }: SellerHomeViewProps) {
  return (
    <>
      <header className='rounded-3xl border bg-card p-6 shadow-xs lg:p-8'>
        <p className='text-sm text-muted-foreground'>Inmobiliaria activa</p>
        <h1 className='mt-2 break-words text-3xl font-semibold tracking-tight md:text-4xl'>Hola, {displayName}</h1>
        <p className='mt-2 break-words text-sm text-muted-foreground'>{tenantName}</p>
      </header>
      <section aria-labelledby='seller-facts-heading' className='space-y-3'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
          <h2 id='seller-facts-heading' className='text-lg font-semibold'>Resumen de gestiones</h2>
          <p className='text-sm text-muted-foreground'>Ventanas móviles · America/Argentina/Buenos_Aires</p>
        </div>
        <ul className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <Fact label='Mis gestiones asignadas' meaning='Gestiones activas sin archivar asignadas en la inmobiliaria activa.' state={products} value={valueOf(products, 'total')} />
          <Fact label='Movimientos en las últimas 24 horas' meaning='Movimientos creados en la ventana móvil de las últimas 24 horas; no incluye solicitudes documentales.' state={activity} value={valueOf(activity, 'todayCount')} />
          <Fact label='Requieren seguimiento' meaning='Último movimiento de consulta, visita completada u oferta recibida sin próximo paso informado.' state={activity} value={valueOf(activity, 'attentionCount')} />
          <Fact label='Sin movimientos en los últimos 7 días' meaning='Sin movimientos en la ventana móvil de los últimos 7 días.' state={activity} value={valueOf(activity, 'staleCount')} />
        </ul>
      </section>
      <section aria-labelledby='seller-priorities-heading' className='rounded-3xl border bg-card p-5 shadow-xs'>
        <h2 id='seller-priorities-heading' className='text-lg font-semibold'>Prioridades</h2>
        {'data' in activity ? (
          <ul className='mt-3 space-y-2'>
            <Priority count={activity.data.counters.attentionCount} description='Último movimiento de consulta, visita completada u oferta recibida sin próximo paso informado.' label='Requieren seguimiento' state={activity} />
            <Priority count={activity.data.counters.staleCount} description='Sin movimientos en la ventana móvil de los últimos 7 días.' label='Sin movimientos en los últimos 7 días' state={activity} />
          </ul>
        ) : <Unavailable label='Prioridades de actividad' state={activity} />}
      </section>
    </>
  );
}

function valueOf(state: SellerProductsState | SellerActivityState, key: 'total' | 'todayCount' | 'attentionCount' | 'staleCount') {
  if (!('data' in state)) return undefined;
  const data = state.data as { counters?: Record<string, number>; total?: number };
  return key === 'total' ? data.total : data.counters?.[key];
}

function Fact({ label, meaning, state, value }: { label: string; meaning: string; state: SellerState; value: number | undefined }) {
  return <li><Card className='h-full rounded-3xl py-0'><CardContent className='space-y-2 p-5'>
    <Icons.product aria-hidden='true' className='size-5 text-muted-foreground' />
    <p className='font-medium'>{label}</p>
    <p className='text-3xl font-semibold'>{value === undefined ? <Unavailable label={label} retry={false} state={state} /> : value}</p>
    <p className='text-sm text-muted-foreground'>{meaning}</p>
    <StateLabel state={state} />
  </CardContent></Card></li>;
}

function Priority({ count, description, label, state }: { count: number; description: string; label: string; state: SellerActivityState }) {
  return <li className='rounded-2xl border bg-muted/20 p-3'>
    <p className='font-medium'>{label}: {count}</p>
    <p className='text-sm text-muted-foreground'>{description}</p>
    <StateLabel state={state} />
  </li>;
}

function StateLabel({ state }: { state: SellerState }) {
  if (state.status === 'refreshing') return <p role='status'>Actualizando…</p>;
  if (state.status === 'retained-error') return <p role='status'>Última información disponible</p>;
  return null;
}

function Unavailable({ label, retry = true, state }: { label: string; retry?: boolean; state: SellerState }) {
  if (state.status === 'loading') return <span aria-label={`Preparando ${label.toLowerCase()}`}>Preparando…</span>;
  if (state.status === 'error' || state.status === 'retained-error') {
    const retryLabel = `Reintentar ${label.toLowerCase()}`;
    return <span role='alert' aria-label={`${label} no disponible`} className='block text-sm font-normal'>Información no disponible {retry ? <Button type='button' variant='outline' onClick={state.retry} disabled={state.retrying}>{state.retrying ? `Reintentando ${label.toLowerCase()}…` : retryLabel}</Button> : null}</span>;
  }
  return null;
}
