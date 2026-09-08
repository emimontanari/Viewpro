'use client';

import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardSummaryRange } from '@/features/dashboard/api/types';
import { getUserDisplayName, type TenantMembership } from '@/lib/session';
import { useActiveTenant, useSession } from '@/lib/session-context';
import {
  ManagerRecentActivity,
  ManagerShortcuts,
  ManagerSummary,
  ManagerTopProperties,
  ManagerTopSellers,
  ManagerUnavailablePanel
} from './operational-homepage/manager-sections';
import {
  PropertyPreviewList,
  RecentActivityList
} from './operational-homepage/lists';
import {
  MissingInmobiliariaState,
  OperationalHomepageSkeleton,
  UnsupportedDashboardRoleState
} from './operational-homepage/states';
import { formatArgentinaCalendarDate, getManagerShortcuts } from './operational-homepage/helpers';
import { useManagerSummary } from './operational-homepage/manager-home';
import {
  SellerOperationalHomepage,
  type SellerActivityState,
  type SellerProductsState
} from './operational-homepage/seller-home';
import { SellerHomeView } from './operational-homepage/seller-sections';

export function OperationalHomepage({ nowMs }: { nowMs?: number }) {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const { session } = useSession();

  if (isTenantLoading) {
    return <OperationalHomepageSkeleton />;
  }

  if (!activeTenantId || !activeMembership) {
    return <MissingInmobiliariaState />;
  }

  if (activeMembership.tenant.id !== activeTenantId) {
    return <OperationalHomepageSkeleton />;
  }

  const displayName = getUserDisplayName(session?.user).trim();

  if (isSellerMembership(activeMembership) && displayName) {
    return (
      <SellerOperationalHomepage activeTenantId={activeTenantId} membershipId={activeMembership.id}>
        {(states) => <SellerHomeContent activeMembership={activeMembership} displayName={displayName} {...states} />}
      </SellerOperationalHomepage>
    );
  }

  if (isManagerMembership(activeMembership) && displayName) {
    return (
      <ManagerOperationalHomepage
        activeMembership={activeMembership}
        activeTenantId={activeTenantId}
        displayName={displayName}
        now={new Date(nowMs ?? Date.now())}
      />
    );
  }

  return <UnsupportedDashboardRoleState />;
}

function ManagerOperationalHomepage({
  activeMembership,
  activeTenantId,
  displayName,
  now
}: {
  activeMembership: TenantMembership;
  activeTenantId: string;
  displayName: string;
  now: Date;
}) {
  const [selectedRange, setSelectedRange] = React.useState<DashboardSummaryRange>('7d');
  const [today] = React.useState(() => formatArgentinaCalendarDate(now));
  const summary = useManagerSummary({ range: selectedRange, tenantId: activeTenantId });
  const shortcuts = getManagerShortcuts(activeMembership, false);

  return (
    <section className='min-w-0 space-y-6'>
      <div className='overflow-hidden rounded-3xl border bg-card shadow-xs'>
        <div className='space-y-5 p-6 lg:p-8'>
          <Badge variant='outline' className='rounded-full bg-muted/40'>
            Panel de inmobiliaria
          </Badge>
          <div className='max-w-3xl space-y-3'>
            <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>Hola, {displayName}</h1>
            <p className='text-sm text-muted-foreground'>
              {activeMembership.tenant.name} · <time dateTime={today.dateTime}>{today.label}</time>
            </p>
            <p className='text-base text-muted-foreground md:text-lg'>
              Detectá qué gestiones se están moviendo, qué propiedades piden atención y quiénes
              están generando actividad para decidir por dónde empezar.
            </p>
          </div>
        </div>
      </div>

      {summary.status === 'ready' ? (
        <ManagerSummary data={summary.data} onRangeChange={setSelectedRange} range={selectedRange} />
      ) : summary.status === 'error' ? (
        <div role='alert'>
          <ManagerUnavailablePanel
            retry={summary.retry}
            retrying={summary.retrying}
            title='Resumen operativo no disponible'
          />
        </div>
      ) : (
        <div
          aria-label='Preparando resumen operativo'
          className='h-44 animate-pulse rounded-2xl bg-muted'
        />
      )}

      <ManagerRecentActivity range={selectedRange} summary={summary} />

          <div className='grid gap-5 xl:grid-cols-2'>
            <ManagerTopProperties range={selectedRange} summary={summary} />
            <ManagerTopSellers summary={summary} />
          </div>

          <ManagerShortcuts shortcuts={shortcuts} />
        </section>
  );
}

function SellerHomeContent({
  activeMembership,
  activity,
  displayName,
  products
}: {
  activeMembership: TenantMembership;
  activity: SellerActivityState;
  displayName: string;
  products: SellerProductsState;
}) {
  const productsData = 'data' in products ? products.data : undefined;
  const activityData = 'data' in activity ? activity.data : undefined;

  return (
    <section className='min-w-0 space-y-6'>
      <SellerHomeView
        activity={activity}
        displayName={displayName}
        products={products}
        tenantName={activeMembership.tenant.name}
      />

      <div className='grid gap-5 xl:grid-cols-2'>
        <Card className='py-0'>
          <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle role='heading' aria-level={2}>
                Mis propiedades asignadas
              </CardTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                Abrí una gestión para revisar el detalle y cargar una actualización.
              </p>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link href='/dashboard/product'>Abrir listado</Link>
            </Button>
          </CardHeader>
          <CardContent className='p-5'>
            <SellerDataState state={products} label='Propiedades asignadas'>
              <PropertyPreviewList
                emptyDescription='Todavía no tenés propiedades activas asignadas. Cuando una gestión quede a tu cargo, va a aparecer acá.'
                emptyTitle='Sin propiedades asignadas'
                isLoading={false}
                products={productsData?.items ?? []}
              />
            </SellerDataState>
          </CardContent>
        </Card>

        <Card className='py-0'>
          <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle role='heading' aria-level={2}>
                Actividad de mis propiedades
              </CardTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                Movimientos y solicitudes documentales vinculadas a tus gestiones.
              </p>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link href='/dashboard/seguimiento'>Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className='p-5'>
            <SellerDataState state={activity} label='Actividad'>
              <RecentActivityList isLoading={false} items={activityData?.items ?? []} />
            </SellerDataState>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function SellerDataState({
  children,
  label,
  state
}: {
  children: React.ReactNode;
  label: string;
  state: SellerProductsState | SellerActivityState;
}) {
  if (state.status === 'loading') {
    return <p aria-label={`Preparando ${label.toLowerCase()}`}>Preparando {label.toLowerCase()}</p>;
  }

  if (state.status === 'error') {
    return <UnavailableSellerData label={label} retry={state.retry} retrying={state.retrying} />;
  }

  return (
    <>
      {state.status === 'refreshing' ? <p role='status'>Actualizando…</p> : null}
      {state.status === 'retained-error' ? (
        <UnavailableSellerData label={label} retry={state.retry} retrying={state.retrying} retained />
      ) : null}
      {children}
    </>
  );
}

function UnavailableSellerData({
  label,
  retained = false,
  retry,
  retrying
}: {
  label: string;
  retained?: boolean;
  retry: () => void;
  retrying: boolean;
}) {
  const retryLabel = `Reintentar ${label.toLowerCase()}`;
  const availability = `${label} no ${label === 'Actividad' ? 'disponible' : 'disponibles'}`;

  return (
    <div role='alert' aria-label={availability} className='space-y-3 rounded-2xl border border-dashed p-4'>
      <p>{retained ? 'No se pudo actualizar; mostramos la última información disponible' : availability}</p>
      <Button type='button' variant='outline' onClick={retry} disabled={retrying}>
        {retrying ? `Reintentando ${label.toLowerCase()}…` : retryLabel}
      </Button>
    </div>
  );
}

function isSellerMembership(membership: TenantMembership) {
  return membership.role === 'AGENT';
}

function isManagerMembership(membership: TenantMembership) {
  return membership.role === 'MANAGER' || membership.role === 'PRINCIPAL_MANAGER';
}
