'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import { dashboardSummaryOptions } from '@/features/dashboard/api/queries';
import type {
  DashboardSummaryRange,
  DashboardSummaryTopProperty,
  DashboardSummaryTopSeller
} from '@/features/dashboard/api/types';
import { productsQueryOptions } from '@/features/products/api/queries';
import type { Product } from '@/features/products/api/types';
import {
  getAddress,
  getStatusLabel,
  getStatusTone
} from '@/features/products/components/product-tables/columns';
import { useActiveTenant } from '@/lib/session-context';
import { cn } from '@/lib/utils';

const PROPERTY_PREVIEW_SIZE = 6;
const ROW_ACTION_CLASS = 'size-8 rounded-full border bg-background shadow-xs';

const RANGE_OPTIONS: Array<{ label: string; range: DashboardSummaryRange; days: number }> = [
  { label: '7 días', range: '7d', days: 7 },
  { label: '14 días', range: '14d', days: 14 },
  { label: '30 días', range: '30d', days: 30 }
];

export function OperationalHomepage() {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const [selectedRange, setSelectedRange] = React.useState<DashboardSummaryRange>('7d');
  const selectedRangeOption = getRangeOption(selectedRange);
  const summaryQuery = useQuery({
    ...dashboardSummaryOptions({
      range: selectedRange,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId) && !isTenantLoading,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
  const productsQuery = useQuery({
    ...productsQueryOptions({
      archived: 'active',
      limit: PROPERTY_PREVIEW_SIZE,
      page: 1,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId) && !isTenantLoading,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });

  if (isTenantLoading) {
    return <OperationalHomepageSkeleton />;
  }

  if (!activeTenantId || !activeMembership) {
    return <MissingInmobiliariaState />;
  }

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

function RangeSelector({
  onSelectRange,
  selectedRange
}: {
  onSelectRange: (range: DashboardSummaryRange) => void;
  selectedRange: DashboardSummaryRange;
}) {
  return (
    <div className='space-y-2'>
      <p className='text-sm font-medium text-muted-foreground'>Período del resumen</p>
      <div className='inline-flex flex-wrap gap-2 rounded-2xl border bg-muted/30 p-1'>
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.range}
            type='button'
            variant={selectedRange === option.range ? 'default' : 'ghost'}
            size='sm'
            className='min-w-20 rounded-xl'
            aria-pressed={selectedRange === option.range}
            onClick={() => onSelectRange(option.range)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function PriorityCard({
  attentionCount,
  documentRequestCount,
  hasDataError,
  isLoading,
  rangeDays,
  staleCount
}: {
  attentionCount: number;
  documentRequestCount: number;
  hasDataError: boolean;
  isLoading: boolean;
  rangeDays: number;
  staleCount: number;
}) {
  return (
    <Card className='border-dashed bg-muted/20 py-0'>
      <CardContent className='space-y-4 p-5'>
        <div className='flex items-center gap-3'>
          <div className='flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground'>
            <Icons.clock className='size-5' />
          </div>
          <div>
            <p className='text-sm text-muted-foreground'>Prioridad del día</p>
            <p className='font-semibold'>Atender antes de que pregunten</p>
          </div>
        </div>
        <p className='text-sm text-muted-foreground'>
          Usá este paneo para mantener las gestiones visibles, ordenar documentos y reducir
          consultas repetitivas.
        </p>
        <div className='rounded-2xl border bg-background/70 p-3 text-sm'>
          {hasDataError
            ? 'No se pudo cargar el resumen. Reintentá en unos segundos.'
            : isLoading
              ? 'Preparando el resumen operativo…'
              : `${staleCount} gestiones no tuvieron novedades en ${rangeDays} días.`}
        </div>
        <div className='grid gap-2'>
          <PriorityLink
            action='Actualizar'
            ariaLabel={`Ver ${staleCount} gestiones sin novedades en ${rangeDays} días en seguimiento`}
            count={staleCount}
            href='/dashboard/seguimiento'
            label={`Sin novedades en ${rangeDays} días`}
          />
          <PriorityLink
            action='Resolver'
            ariaLabel={`Ver ${attentionCount} próximos pasos pendientes en seguimiento`}
            count={attentionCount}
            href='/dashboard/seguimiento'
            label='Próximos pasos pendientes'
          />
          <PriorityLink
            action='Revisar'
            ariaLabel={`Ver ${documentRequestCount} documentos recientes en seguimiento`}
            count={documentRequestCount}
            href='/dashboard/seguimiento?kind=document_request'
            label='Documentos recientes'
          />
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityLink({
  action,
  ariaLabel,
  count,
  href,
  label
}: {
  action: string;
  ariaLabel: string;
  count: number;
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className='flex min-h-11 items-center justify-between gap-3 rounded-2xl border bg-background/80 px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground'
    >
      <span className='min-w-0'>
        <span className='block font-medium'>{action}</span>
        <span className='block truncate text-muted-foreground'>{label}</span>
      </span>
      <span className='shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'>
        {count}
      </span>
    </Link>
  );
}

function KpiCard({
  helper,
  icon: Icon,
  isLoading,
  label,
  value
}: {
  helper: string;
  icon: typeof Icons.product;
  isLoading: boolean;
  label: string;
  value: number;
}) {
  return (
    <Card className='py-0'>
      <CardContent className='flex items-start gap-4 p-5'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
          <Icon className='size-5' />
        </div>
        <div className='min-w-0 space-y-1'>
          <p className='text-sm font-medium text-muted-foreground'>{label}</p>
          {isLoading ? (
            <div className='h-8 w-16 animate-pulse rounded bg-muted' />
          ) : (
            <p className='text-3xl font-semibold tracking-tight'>{value}</p>
          )}
          <p className='text-sm text-muted-foreground'>{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivityList({
  isLoading,
  items
}: {
  isLoading: boolean;
  items: ActivityFeedItem[];
}) {
  if (isLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (items.length === 0) {
    return (
      <EmptyPanel
        icon={Icons.clock}
        title='Sin movimientos recientes'
        description='Cuando haya movimientos o solicitudes documentales, van a aparecer acá.'
      />
    );
  }

  return (
    <ol className='space-y-3'>
      {items.map((item) => (
        <li key={item.id} className='rounded-2xl border bg-muted/20 p-3'>
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0 space-y-1'>
              <Badge variant='outline' className='rounded-full bg-background'>
                {item.kind === 'document_request' ? 'Documento' : 'Movimiento'}
              </Badge>
              <p className='truncate font-medium'>{getActivityTitle(item)}</p>
              <p className='truncate text-sm text-muted-foreground'>
                {getActivityDescription(item)}
              </p>
            </div>
            <Button
              asChild
              variant='outline'
              size='icon'
              className={cn('shrink-0', ROW_ACTION_CLASS)}
            >
              <Link
                href={`/dashboard/product/${item.property.engagementId}`}
                aria-label={`Abrir actividad: ${getActivityTitle(item)}`}
              >
                <Icons.externalLink className='size-4' aria-hidden='true' />
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function PropertyPreviewList({ isLoading, products }: { isLoading: boolean; products: Product[] }) {
  if (isLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (products.length === 0) {
    return (
      <EmptyPanel
        icon={Icons.product}
        title='Sin propiedades activas'
        description='Creá una propiedad para empezar a operar la gestión desde ViewPro.'
      />
    );
  }

  return (
    <ol className='space-y-3'>
      {products.map((product) => (
        <li key={product.id} className='rounded-2xl border bg-muted/20 p-3'>
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0 space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='truncate font-medium'>
                  {product.property.title || 'Propiedad sin título'}
                </p>
                <Badge
                  variant='outline'
                  className={cn('rounded-full', getStatusTone(product.status))}
                >
                  {getStatusLabel(product.status)}
                </Badge>
              </div>
              <p className='truncate text-sm text-muted-foreground'>{getAddress(product)}</p>
            </div>
            <Button
              asChild
              variant='outline'
              size='icon'
              className={cn('shrink-0', ROW_ACTION_CLASS)}
            >
              <Link
                href={`/dashboard/product/${product.id}`}
                aria-label={`Abrir propiedad: ${product.property.title || 'Propiedad sin título'}`}
              >
                <Icons.externalLink className='size-4' aria-hidden='true' />
              </Link>
            </Button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function TopPropertiesCard({
  isLoading,
  properties,
  rangeLabel
}: {
  isLoading: boolean;
  properties: DashboardSummaryTopProperty[];
  rangeLabel: string;
}) {
  return (
    <Card className='py-0'>
      <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <CardTitle role='heading' aria-level={2}>
            Propiedades con más movimiento
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            Lectura rápida basada en movimientos y documentos del período.
          </p>
        </div>
        <Badge variant='outline' className='w-fit rounded-full bg-muted/40'>
          Últimos {rangeLabel}
        </Badge>
      </CardHeader>
      <CardContent className='p-5'>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : properties.length === 0 ? (
          <EmptyPanel
            icon={Icons.product}
            title='Sin actividad para comparar'
            description='Cuando se registren movimientos, vas a ver qué propiedades concentraron más actividad en el período.'
          />
        ) : (
          <ol className='space-y-3'>
            {properties.map((insight) => (
              <li key={insight.engagementId} className='rounded-2xl border bg-muted/20 p-3'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0 space-y-1'>
                    <p className='truncate font-medium'>{getDashboardPropertyTitle(insight)}</p>
                    <p className='text-sm text-muted-foreground'>
                      {formatCount(insight.movementCount, 'movimiento', 'movimientos')}
                      {insight.documentRequestCount > 0
                        ? ` · ${formatCount(insight.documentRequestCount, 'documento', 'documentos')}`
                        : null}
                    </p>
                    <p className='truncate text-sm text-muted-foreground'>
                      Último: {insight.lastActivityTitle}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant='outline'
                    size='icon'
                    className={cn('shrink-0', ROW_ACTION_CLASS)}
                  >
                    <Link
                      href={`/dashboard/product/${insight.engagementId}`}
                      aria-label={`Abrir propiedad ${getDashboardPropertyTitle(insight)}`}
                    >
                      <Icons.externalLink className='size-4' aria-hidden='true' />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function SellerActivityCard({
  isLoading,
  rangeLabel,
  sellers
}: {
  isLoading: boolean;
  rangeLabel: string;
  sellers: DashboardSummaryTopSeller[];
}) {
  return (
    <Card className='py-0'>
      <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <CardTitle role='heading' aria-level={2}>
            Vendedores con más movimiento
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            Quiénes están generando actividad en las gestiones del período.
          </p>
        </div>
        <Badge variant='outline' className='w-fit rounded-full bg-muted/40'>
          Últimos {rangeLabel}
        </Badge>
      </CardHeader>
      <CardContent className='p-5'>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : sellers.length === 0 ? (
          <EmptyPanel
            icon={Icons.profile}
            title='Sin movimientos de vendedores'
            description='Cuando el equipo registre movimientos manuales, vas a ver la actividad por vendedor.'
          />
        ) : (
          <ol className='space-y-3'>
            {sellers.map((seller) => (
              <li key={seller.userId} className='rounded-2xl border bg-muted/20 p-3'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0 space-y-1'>
                    <p className='truncate font-medium'>{seller.name}</p>
                    <p className='truncate text-sm text-muted-foreground'>{seller.email}</p>
                    <p className='text-sm text-muted-foreground'>
                      {formatCount(seller.movementCount, 'movimiento', 'movimientos')} ·{' '}
                      {formatCount(
                        seller.touchedPropertiesCount,
                        'propiedad tocada',
                        'propiedades tocadas'
                      )}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant='outline'
                    size='sm'
                    className={cn('shrink-0', ROW_ACTION_CLASS)}
                  >
                    <Link
                      href={`/dashboard/seguimiento?sellerId=${encodeURIComponent(seller.userId)}`}
                      aria-label={`Ver movimientos de ${seller.name}`}
                    >
                      Ver
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPanel({
  description,
  icon: Icon,
  title
}: {
  description: string;
  icon: typeof Icons.product;
  title: string;
}) {
  return (
    <div className='rounded-2xl border border-dashed bg-muted/20 p-6 text-center'>
      <div className='mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground'>
        <Icon className='size-5' />
      </div>
      <p className='font-medium'>{title}</p>
      <p className='mx-auto mt-1 max-w-md text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className='space-y-3' aria-label='Cargando resumen operativo'>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className='space-y-3 rounded-2xl border p-3'>
          <div className='h-4 w-24 animate-pulse rounded bg-muted' />
          <div className='h-5 w-2/3 animate-pulse rounded bg-muted' />
          <div className='h-4 w-full animate-pulse rounded bg-muted' />
        </div>
      ))}
    </div>
  );
}

function MissingInmobiliariaState() {
  return (
    <div className='rounded-3xl border bg-card p-8 text-center shadow-xs'>
      <div className='mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        <Icons.workspace className='size-6' />
      </div>
      <h1 className='text-2xl font-semibold'>Elegí una inmobiliaria para continuar</h1>
      <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>
        Seleccioná una inmobiliaria desde el menú lateral para ver prioridades, propiedades y
        actividad reciente.
      </p>
      <Button asChild className='mt-5'>
        <Link href='/dashboard/workspaces'>Ir a inmobiliarias</Link>
      </Button>
    </div>
  );
}

function OperationalHomepageSkeleton() {
  return (
    <section className='space-y-5' aria-label='Preparando inicio operativo'>
      <div className='h-64 animate-pulse rounded-3xl bg-muted' />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className='h-36 animate-pulse rounded-2xl bg-muted' />
        ))}
      </div>
      <div className='grid gap-5 xl:grid-cols-2'>
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
      </div>
      <div className='grid gap-5 xl:grid-cols-2'>
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
        <div className='h-72 animate-pulse rounded-2xl bg-muted' />
      </div>
    </section>
  );
}

function getActivityTitle(item: ActivityFeedItem) {
  if (item.kind === 'document_request') {
    return item.documentRequest.title;
  }

  return item.observation;
}

function getActivityDescription(item: ActivityFeedItem) {
  const propertyTitle = getActivityPropertyTitle(item.property);

  if (item.kind === 'document_request') {
    return `Solicitud documental en ${propertyTitle}`;
  }

  return item.nextStep ? `${propertyTitle} · Próximo paso: ${item.nextStep}` : propertyTitle;
}

function getActivityPropertyTitle(property: ActivityFeedItem['property']) {
  return property.title || property.addressLine || 'Propiedad sin título';
}

function getDashboardPropertyTitle(property: DashboardSummaryTopProperty) {
  return property.title || property.addressLine || 'Propiedad sin título';
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function getRangeOption(range: DashboardSummaryRange) {
  return RANGE_OPTIONS.find((option) => option.range === range) ?? RANGE_OPTIONS[0];
}
