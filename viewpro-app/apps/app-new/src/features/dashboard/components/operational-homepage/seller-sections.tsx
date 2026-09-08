import Link from 'next/link';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { SellerActivityState, SellerProductsState } from './seller-home';
import { SellerActivityList, SellerPropertyList } from './seller-lists';

export type SellerShortcut = {
  href: '/dashboard/product' | '/dashboard/seguimiento';
  icon: 'product' | 'trendingUp';
  label: string;
};

type SellerHomeViewProps = {
  activity: SellerActivityState;
  displayName: string;
  products: SellerProductsState;
  shortcuts: readonly SellerShortcut[];
  tenantName: string;
};

type SellerState = SellerProductsState | SellerActivityState;

export function SellerHomeView({ activity, displayName, products, shortcuts, tenantName }: SellerHomeViewProps) {
  return (
    <>
      <header className='min-w-0 rounded-3xl border bg-card p-6 shadow-xs lg:p-8'>
        <p className='text-sm text-muted-foreground'>Inmobiliaria activa</p>
        <h1 className='mt-2 break-words text-3xl font-semibold tracking-tight md:text-4xl'>Hola, {displayName}</h1>
        <p className='mt-2 break-words text-sm text-muted-foreground'>{tenantName}</p>
      </header>
      <section aria-labelledby='seller-facts-heading' className='min-w-0 space-y-3'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
          <h2 id='seller-facts-heading' className='text-lg font-semibold'>Resumen de gestiones</h2>
          <p className='text-sm text-muted-foreground'>Ventanas móviles · America/Argentina/Buenos_Aires</p>
        </div>
        <ul aria-label='Hechos del resumen' className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          <Fact label='Mis gestiones asignadas' meaning='Gestiones activas sin archivar asignadas en la inmobiliaria activa.' state={products} value={valueOf(products, 'total')} />
          <Fact label='Movimientos en las últimas 24 horas' meaning='Movimientos creados en la ventana móvil de las últimas 24 horas; no incluye solicitudes documentales.' state={activity} value={valueOf(activity, 'todayCount')} />
          <Fact label='Requieren seguimiento' meaning='Último movimiento de consulta, visita completada u oferta recibida sin próximo paso informado.' state={activity} value={valueOf(activity, 'attentionCount')} />
          <Fact label='Sin movimientos en los últimos 7 días' meaning='Sin movimientos en la ventana móvil de los últimos 7 días.' state={activity} value={valueOf(activity, 'staleCount')} />
        </ul>
      </section>
      <section aria-labelledby='seller-priorities-heading' className='min-w-0 rounded-3xl border bg-card p-5 shadow-xs'>
        <h2 id='seller-priorities-heading' className='text-lg font-semibold'>Prioridades</h2>
        {'data' in activity ? (
          <ul aria-label='Prioridades de seguimiento' className='mt-3 min-w-0 space-y-2'>
            <Priority count={activity.data.counters.attentionCount} description='Último movimiento de consulta, visita completada u oferta recibida sin próximo paso informado.' label='Requieren seguimiento' state={activity} />
            <Priority count={activity.data.counters.staleCount} description='Sin movimientos en la ventana móvil de los últimos 7 días.' label='Sin movimientos en los últimos 7 días' state={activity} />
          </ul>
        ) : <Unavailable label='Prioridades de actividad' state={activity} />}
      </section>
      <div className='grid min-w-0 gap-5 xl:grid-cols-2'>
        <SellerContentSection accessibleLabel='Mis propiedades' description='Gestiones asignadas de la inmobiliaria activa.' heading='Mis propiedades asignadas' headingId='seller-engagements-heading' state={products} unavailableLabel='Propiedades asignadas'>
          <SellerPropertyList state={products} />
        </SellerContentSection>
        <SellerContentSection accessibleLabel='Actividad reciente' description='Movimientos y solicitudes documentales permitidos vinculados a tus gestiones.' heading='Actividad de mis propiedades' headingId='seller-activity-heading' state={activity} unavailableLabel='Actividad'>
          <SellerActivityList state={activity} />
        </SellerContentSection>
      </div>
      <nav aria-labelledby='seller-shortcuts-heading' className='min-w-0 rounded-3xl border bg-card p-5 shadow-xs'>
        <h2 id='seller-shortcuts-heading' className='text-lg font-semibold'>Accesos rápidos</h2>
        <div className='mt-3 grid min-w-0 gap-3 sm:grid-cols-2'>
          {shortcuts.map((shortcut) => {
            const Icon = Icons[shortcut.icon];
            return (
              <Link key={shortcut.href} className='flex min-h-11 min-w-11 items-center gap-3 rounded-2xl border p-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' href={shortcut.href}>
                <Icon aria-hidden='true' className='size-5 text-muted-foreground' />
                {shortcut.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function SellerContentSection({ accessibleLabel, children, description, heading, headingId, state, unavailableLabel }: { accessibleLabel: string; children: React.ReactNode; description: string; heading: string; headingId: 'seller-engagements-heading' | 'seller-activity-heading'; state: SellerState; unavailableLabel: string }) {
  return (
    <section aria-labelledby={headingId} className='min-w-0'>
      <Card className='h-full py-0'>
        <CardContent className='space-y-4 p-5'>
          <div>
            <h2 aria-label={accessibleLabel} id={headingId} className='text-lg font-semibold'>{heading}</h2>
            <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
          </div>
          {'data' in state ? <><StateLabel state={state} />{state.status === 'retained-error' ? <Unavailable label={unavailableLabel} state={state} /> : null}{children}</> : <Unavailable label={unavailableLabel} state={state} />}
        </CardContent>
      </Card>
    </section>
  );
}

function valueOf(state: SellerProductsState | SellerActivityState, key: 'total' | 'todayCount' | 'attentionCount' | 'staleCount') {
  if (!('data' in state)) return undefined;
  const data = state.data as { counters?: Record<string, number>; total?: number };
  return key === 'total' ? data.total : data.counters?.[key];
}

function Fact({ label, meaning, state, value }: { label: string; meaning: string; state: SellerState; value: number | undefined }) {
  return <li className='min-w-0'><Card className='h-full min-w-0 rounded-3xl py-0'><CardContent className='min-w-0 space-y-2 p-5'>
    <Icons.product aria-hidden='true' className='size-5 text-muted-foreground' />
    <p className='break-words font-medium'>{label}</p>
    <p className='text-3xl font-semibold'>{value === undefined ? <Unavailable label={label} retry={false} state={state} /> : value}</p>
    <p className='break-words text-sm text-muted-foreground'>{meaning}</p>
    <StateLabel state={state} />
  </CardContent></Card></li>;
}

function Priority({ count, description, label, state }: { count: number; description: string; label: string; state: SellerActivityState }) {
  return <li className='min-w-0 rounded-2xl border bg-muted/20'>
    <Link className='flex min-h-11 min-w-11 flex-col justify-center rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' href='/dashboard/seguimiento'>
      <p className='break-words font-medium'>{label}: {count}</p>
      <p className='break-words text-sm text-muted-foreground'>{description}</p>
      <StateLabel state={state} />
    </Link>
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
    const availability = `${label} no ${label === 'Propiedades asignadas' ? 'disponibles' : 'disponible'}`;
    return <span role='alert' aria-label={availability} className='block text-sm font-normal'>Información no disponible {retry ? <Button className='min-h-11 min-w-11 whitespace-normal text-left' type='button' variant='outline' onClick={state.retry} disabled={state.retrying}>{state.retrying ? `Reintentando ${label.toLowerCase()}…` : retryLabel}</Button> : null}</span>;
  }
  return null;
}
