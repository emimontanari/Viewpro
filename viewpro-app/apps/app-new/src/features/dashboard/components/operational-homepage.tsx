'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { activityFeedOptions } from '@/features/activity/api/queries';
import { dashboardSummaryOptions } from '@/features/dashboard/api/queries';
import type { DashboardSummaryRange
} from '@/features/dashboard/api/types';
import { productsQueryOptions } from '@/features/products/api/queries';
import type { TenantMembership } from '@/lib/session';
import { useActiveTenant } from '@/lib/session-context';
import { KpiCard
} from './operational-homepage/primitives';
import { PriorityCard, PriorityLink } from './operational-homepage/priority-panel';
import { PropertyPreviewList,
  RecentActivityList,
  SellerActivityCard,
  TopPropertiesCard
} from './operational-homepage/lists';
import { RangeSelector } from './operational-homepage/range-selector';
import { MissingInmobiliariaState,
  OperationalHomepageSkeleton
} from './operational-homepage/states';
import { getRangeOption } from './operational-homepage/helpers';
import { PROPERTY_PREVIEW_SIZE, SELLER_ACTIVITY_PREVIEW_SIZE } from './operational-homepage/constants';

export function OperationalHomepage() { const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();

  if (isTenantLoading) { return <OperationalHomepageSkeleton />;
  }

  if (!activeTenantId || !activeMembership) { return <MissingInmobiliariaState />;
  }

  if (isSellerMembership(activeMembership)) { return (
      <SellerOperationalHomepage
        activeMembership={activeMembership}
        activeTenantId={activeTenantId}
      />
    );
  }

  return (
    <ManagerOperationalHomepage
      activeMembership={activeMembership}
      activeTenantId={activeTenantId}
    />
  );
}

function ManagerOperationalHomepage({ activeMembership,
  activeTenantId
}: { activeMembership: TenantMembership;
  activeTenantId: string;
}) { const [selectedRange, setSelectedRange] = React.useState<DashboardSummaryRange>('7d');
  const selectedRangeOption = getRangeOption(selectedRange);
  const summaryQuery = useQuery({
    ...dashboardSummaryOptions({ range: selectedRange,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  const productsQuery = useQuery({
    ...productsQueryOptions({ archived: 'active',
      limit: PROPERTY_PREVIEW_SIZE,
      page: 1,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  const counters = summaryQuery.data?.counters;
  const activePropertiesTotal = counters?.activeProperties ?? productsQuery.data?.total ?? 0;
  const stalePropertiesTotal = counters?.staleProperties ?? 0;
  const movementsInRange = counters?.movementsInRange ?? 0;
  const attentionNeeded = counters?.attentionNeeded ?? 0;
  const recentActivity = summaryQuery.data?.recentActivity ?? [];
  const propertyPreview = productsQuery.data?.items ?? [];
  const recentDocumentRequests = recentActivity.filter(
    (item) => item.kind === 'document_request'
  ).length;
  const topProperties = summaryQuery.data?.topProperties ?? [];
  const sellerInsights = summaryQuery.data?.topSellers ?? [];
  const isLoadingData = summaryQuery.isLoading || productsQuery.isLoading;
  const hasDataError = summaryQuery.isError || productsQuery.isError;

  return (
    <section className='min-w-0 space-y-6'>
      <div className='overflow-hidden rounded-3xl border bg-card shadow-xs'>
        <div className='grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:p-8'>
          <div className='space-y-5'>
            <Badge variant='outline' className='rounded-full bg-muted/40'>
              Panel de inmobiliaria
            </Badge>
            <div className='max-w-3xl space-y-3'>
              <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>
                Inicio operativo de {activeMembership.tenant.name}
              </h1>
              <p className='text-base text-muted-foreground md:text-lg'>
                Detectá qué gestiones se están moviendo, qué propiedades piden atención y quiénes
                están generando actividad para decidir por dónde empezar.
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Link href='/dashboard/seguimiento' className={buttonVariants({ size: 'sm' })}>
                <Icons.trendingUp className='size-4' />
                Ver seguimiento
              </Link>
              <Link
                href='/dashboard/product/new'
                className={buttonVariants({ size: 'sm', variant: 'secondary' })}
              >
                <Icons.add className='size-4' />
                Nueva propiedad
              </Link>
              <Link
                href='/dashboard/product'
                className={buttonVariants({ size: 'sm', variant: 'outline' })}
              >
                <Icons.product className='size-4' />
                Ver propiedades
              </Link>
            </div>
            <RangeSelector selectedRange={selectedRange} onSelectRange={setSelectedRange} />
          </div>

          <PriorityCard
            attentionCount={attentionNeeded}
            documentRequestCount={recentDocumentRequests}
            hasDataError={hasDataError}
            isLoading={isLoadingData}
            rangeDays={selectedRangeOption.days}
            staleCount={stalePropertiesTotal}
          />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <KpiCard
          icon={Icons.warning}
          label={`Sin novedades en ${selectedRangeOption.days} días`}
          value={stalePropertiesTotal}
          helper='Gestiones activas sin movimientos en el período.'
          isLoading={summaryQuery.isLoading}
        />
        <KpiCard
          icon={Icons.clock}
          label='Movimientos del período'
          value={movementsInRange}
          helper={`Actividad registrada en los últimos ${selectedRangeOption.days} días.`}
          isLoading={summaryQuery.isLoading}
        />
        <KpiCard
          icon={Icons.trendingUp}
          label='Requieren atención'
          value={attentionNeeded}
          helper='Consultas, visitas u ofertas sin próximo paso.'
          isLoading={summaryQuery.isLoading}
        />
        <KpiCard
          icon={Icons.product}
          label='Propiedades activas'
          value={activePropertiesTotal}
          helper='Gestiones disponibles para operar.'
          isLoading={summaryQuery.isLoading || productsQuery.isLoading}
        />
      </div>

      <div className='grid gap-5 xl:grid-cols-2'>
        <Card className='py-0'>
          <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle role='heading' aria-level={2}>
                Movimientos rápidos
              </CardTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                Últimas señales de avance para entender qué cambió en el período.
              </p>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link href='/dashboard/seguimiento'>Ver todo</Link>
            </Button>
          </CardHeader>
          <CardContent className='p-5'>
            <RecentActivityList isLoading={summaryQuery.isLoading} items={recentActivity} />
          </CardContent>
        </Card>

        <Card className='py-0'>
          <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle role='heading' aria-level={2}>
                Gestiones para retomar
              </CardTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                Propiedades activas disponibles para retomar trabajo.
              </p>
            </div>
            <Button asChild variant='outline' size='sm'>
              <Link href='/dashboard/product'>Abrir listado</Link>
            </Button>
          </CardHeader>
          <CardContent className='p-5'>
            <PropertyPreviewList isLoading={productsQuery.isLoading} products={propertyPreview} />
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-5 xl:grid-cols-2'>
        <TopPropertiesCard
          isLoading={summaryQuery.isLoading}
          properties={topProperties}
          rangeLabel={selectedRangeOption.label}
        />
        <SellerActivityCard
          isLoading={summaryQuery.isLoading}
          rangeLabel={selectedRangeOption.label}
          sellers={sellerInsights}
        />
      </div>
    </section>
  );
}

function SellerOperationalHomepage({ activeMembership,
  activeTenantId
}: { activeMembership: TenantMembership;
  activeTenantId: string;
}) { const productsQuery = useQuery({
    ...productsQueryOptions({ archived: 'active',
      limit: PROPERTY_PREVIEW_SIZE,
      page: 1,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  const activityQuery = useQuery({
    ...activityFeedOptions({ kind: 'all',
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

function isSellerMembership(membership: TenantMembership) { return membership.role === 'AGENT';
}
