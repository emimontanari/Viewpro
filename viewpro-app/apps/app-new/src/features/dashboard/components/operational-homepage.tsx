'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { activityFeedOptions } from '@/features/activity/api/queries';
import type { DashboardSummaryRange } from '@/features/dashboard/api/types';
import { productsQueryOptions } from '@/features/products/api/queries';
import { getUserDisplayName, type TenantMembership } from '@/lib/session';
import { useActiveTenant, useSession } from '@/lib/session-context';
import { KpiCard } from './operational-homepage/primitives';
import { PriorityLink } from './operational-homepage/priority-panel';
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
  PROPERTY_PREVIEW_SIZE,
  SELLER_ACTIVITY_PREVIEW_SIZE
} from './operational-homepage/constants';

export function OperationalHomepage({ nowMs }: { nowMs?: number }) {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const { session } = useSession();

  if (isTenantLoading) {
    return <OperationalHomepageSkeleton />;
  }

  if (!activeTenantId || !activeMembership) {
    return <MissingInmobiliariaState />;
  }

  if (isSellerMembership(activeMembership)) {
    return (
      <SellerOperationalHomepage
        activeMembership={activeMembership}
        activeTenantId={activeTenantId}
      />
    );
  }

  const displayName = getUserDisplayName(session?.user);

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

function SellerOperationalHomepage({
  activeMembership,
  activeTenantId
}: {
  activeMembership: TenantMembership;
  activeTenantId: string;
}) {
  const productsQuery = useQuery({
    ...productsQueryOptions({
      archived: 'active',
      limit: PROPERTY_PREVIEW_SIZE,
      page: 1,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  const activityQuery = useQuery({
    ...activityFeedOptions({
      kind: 'all',
      page: 1,
      pageSize: SELLER_ACTIVITY_PREVIEW_SIZE,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  const assignedProperties = productsQuery.data?.items ?? [];
  const recentActivity = activityQuery.data?.items ?? [];
  const counters = activityQuery.data?.counters;
  const assignedPropertiesTotal = productsQuery.data?.total ?? 0;
  const todayCount = counters?.todayCount ?? 0;
  const attentionNeeded = counters?.attentionCount ?? 0;
  const stalePropertiesTotal = counters?.staleCount ?? 0;
  const isLoadingData = productsQuery.isLoading || activityQuery.isLoading;
  const hasDataError = productsQuery.isError || activityQuery.isError;

  return (
    <section className='min-w-0 space-y-6'>
      <div className='overflow-hidden rounded-3xl border bg-card shadow-xs'>
        <div className='grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-8'>
          <div className='space-y-5'>
            <Badge variant='outline' className='rounded-full bg-muted/40'>
              Panel de vendedor
            </Badge>
            <div className='max-w-3xl space-y-3'>
              <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
                Tu jornada comercial en {activeMembership.tenant.name}
              </h1>
              <p className='text-base text-muted-foreground md:text-lg'>
                Priorizá tus propiedades asignadas, revisá novedades recientes y entrá directo a
                cargar actualizaciones sin perder tiempo en métricas de toda la inmobiliaria.
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Link href='/dashboard/product' className={buttonVariants({ size: 'sm' })}>
                <Icons.product className='size-4' />
                Ver mis propiedades
              </Link>
              <Link
                href='/dashboard/seguimiento'
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                <Icons.trendingUp className='size-4' />
                Ver seguimiento
              </Link>
            </div>
          </div>

          <Card className='border-dashed bg-muted/20 py-0'>
            <CardContent className='space-y-4 p-5'>
              <div className='flex items-center gap-3'>
                <div className='flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground'>
                  <Icons.clock className='size-5' />
                </div>
                <div>
                  <p className='text-sm text-muted-foreground'>Foco del día</p>
                  <p className='font-semibold'>Mover las gestiones asignadas</p>
                </div>
              </div>
              <p className='text-sm text-muted-foreground'>
                Usá este inicio para retomar propiedades sin novedades, resolver próximos pasos y
                registrar actividad apenas ocurre.
              </p>
              <div className='rounded-2xl border bg-background/70 p-3 text-sm'>
                {hasDataError
                  ? 'No se pudo cargar tu resumen. Reintentá en unos segundos.'
                  : isLoadingData
                    ? 'Preparando tu jornada comercial…'
                    : `${attentionNeeded} gestiones necesitan seguimiento y ${stalePropertiesTotal} siguen sin novedades recientes.`}
              </div>
              <div className='grid gap-2'>
                <PriorityLink
                  action='Retomar'
                  ariaLabel={`Ver ${attentionNeeded} próximos pasos pendientes en seguimiento`}
                  count={attentionNeeded}
                  href='/dashboard/seguimiento'
                  label='Próximos pasos pendientes'
                />
                <PriorityLink
                  action='Actualizar'
                  ariaLabel={`Ver ${stalePropertiesTotal} propiedades asignadas sin novedades recientes`}
                  count={stalePropertiesTotal}
                  href='/dashboard/seguimiento'
                  label='Sin novedades recientes'
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <KpiCard
          icon={Icons.product}
          label='Mis propiedades asignadas'
          value={assignedPropertiesTotal}
          helper='Gestiones activas donde sos parte del equipo comercial.'
          isLoading={productsQuery.isLoading}
        />
        <KpiCard
          icon={Icons.clock}
          label='Actualizaciones hoy'
          value={todayCount}
          helper='Movimientos registrados hoy en tus propiedades.'
          isLoading={activityQuery.isLoading}
        />
        <KpiCard
          icon={Icons.trendingUp}
          label='Necesitan seguimiento'
          value={attentionNeeded}
          helper='Consultas, visitas u ofertas sin próximo paso.'
          isLoading={activityQuery.isLoading}
        />
        <KpiCard
          icon={Icons.warning}
          label='Sin novedades 7 días'
          value={stalePropertiesTotal}
          helper='Propiedades asignadas sin actividad reciente.'
          isLoading={activityQuery.isLoading}
        />
      </div>

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
            <PropertyPreviewList
              emptyDescription='Todavía no tenés propiedades activas asignadas. Cuando una gestión quede a tu cargo, va a aparecer acá.'
              emptyTitle='Sin propiedades asignadas'
              isLoading={productsQuery.isLoading}
              products={assignedProperties}
            />
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
            <RecentActivityList isLoading={activityQuery.isLoading} items={recentActivity} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function isSellerMembership(membership: TenantMembership) {
  return membership.role === 'AGENT';
}

function isManagerMembership(membership: TenantMembership) {
  return membership.role === 'MANAGER' || membership.role === 'PRINCIPAL_MANAGER';
}
