'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { activityFeedOptions } from '@/features/activity/api/queries';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import { productsQueryOptions } from '@/features/products/api/queries';
import type { Product } from '@/features/products/api/types';
import {
  getAddress,
  getStatusLabel,
  getStatusTone
} from '@/features/products/components/product-tables/columns';
import { useActiveTenant } from '@/lib/session-context';
import { cn } from '@/lib/utils';

const ACTIVITY_PREVIEW_SIZE = 20;
const RECENT_ACTIVITY_VISIBLE_SIZE = 5;
const PROPERTY_PREVIEW_SIZE = 6;
const INSIGHT_PREVIEW_SIZE = 3;
const ROW_ACTION_CLASS =
  'h-10 min-w-28 justify-center rounded-full border bg-background px-4 font-medium shadow-xs';

type PropertyInsight = {
  property: ActivityFeedItem['property'];
  activityCount: number;
  movementCount: number;
  documentRequestCount: number;
  latestAt: string;
  latestTitle: string;
};

type SellerInsight = {
  id: string;
  name: string;
  email: string;
  movementCount: number;
  propertyIds: Set<string>;
  latestAt: string;
};

export function OperationalHomepage() {
  const { activeMembership, activeTenantId, isTenantLoading } = useActiveTenant();
  const activityQuery = useQuery({
    ...activityFeedOptions({
      kind: 'all',
      page: 1,
      pageSize: ACTIVITY_PREVIEW_SIZE,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId) && !isTenantLoading
  });
  const productsQuery = useQuery({
    ...productsQueryOptions({
      archived: 'active',
      limit: PROPERTY_PREVIEW_SIZE,
      page: 1,
      tenantId: activeTenantId
    }),
    enabled: Boolean(activeTenantId) && !isTenantLoading
  });

  if (isTenantLoading) {
    return <OperationalHomepageSkeleton />;
  }

  if (!activeTenantId || !activeMembership) {
    return <MissingInmobiliariaState />;
  }

  const counters = activityQuery.data?.counters;
  const activePropertiesTotal = productsQuery.data?.total ?? 0;
  const activityItems = activityQuery.data?.items ?? [];
  const recentActivity = activityItems.slice(0, RECENT_ACTIVITY_VISIBLE_SIZE);
  const propertyPreview = productsQuery.data?.items ?? [];
  const recentDocumentRequests = activityItems.filter(
    (item) => item.kind === 'document_request'
  ).length;
  const topProperties = getRecentPropertyInsights(activityItems).slice(0, INSIGHT_PREVIEW_SIZE);
  const sellerInsights = getSellerMovementInsights(activityItems).slice(0, INSIGHT_PREVIEW_SIZE);
  const isLoadingData = activityQuery.isLoading || productsQuery.isLoading;
  const hasDataError = activityQuery.isError || productsQuery.isError;

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
          </div>

          <PriorityCard
            attentionCount={counters?.attentionCount ?? 0}
            documentRequestCount={recentDocumentRequests}
            hasDataError={hasDataError}
            isLoading={isLoadingData}
            staleCount={counters?.staleCount ?? 0}
          />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <KpiCard
          icon={Icons.warning}
          label='Sin actualización'
          value={counters?.staleCount ?? 0}
          helper='Gestiones que necesitan una novedad visible.'
          isLoading={activityQuery.isLoading}
        />
        <KpiCard
          icon={Icons.clock}
          label='Movimientos hoy'
          value={counters?.todayCount ?? 0}
          helper='Actividad registrada en las últimas 24 horas.'
          isLoading={activityQuery.isLoading}
        />
        <KpiCard
          icon={Icons.trendingUp}
          label='Requieren atención'
          value={counters?.attentionCount ?? 0}
          helper='Consultas, visitas u ofertas sin próximo paso.'
          isLoading={activityQuery.isLoading}
        />
        <KpiCard
          icon={Icons.product}
          label='Propiedades activas'
          value={activePropertiesTotal}
          helper='Gestiones disponibles para operar.'
          isLoading={productsQuery.isLoading}
        />
      </div>

      <div className='grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]'>
        <Card className='py-0'>
          <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
            <div>
              <CardTitle role='heading' aria-level={2}>
                Movimientos rápidos
              </CardTitle>
              <p className='mt-1 text-sm text-muted-foreground'>
                Últimas señales de avance para entender qué cambió en la inmobiliaria.
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
        <TopPropertiesCard isLoading={activityQuery.isLoading} properties={topProperties} />
        <SellerActivityCard isLoading={activityQuery.isLoading} sellers={sellerInsights} />
      </div>
    </section>
  );
}

function PriorityCard({
  attentionCount,
  documentRequestCount,
  hasDataError,
  isLoading,
  staleCount
}: {
  attentionCount: number;
  documentRequestCount: number;
  hasDataError: boolean;
  isLoading: boolean;
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
              : `${staleCount} gestiones necesitan una actualización visible.`}
        </div>
        <div className='grid gap-2'>
          <PriorityLink
            action='Actualizar'
            ariaLabel={`Ver ${staleCount} gestiones sin novedades en seguimiento`}
            count={staleCount}
            href='/dashboard/seguimiento'
            label='Gestiones sin novedades'
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
            ariaLabel={`Ver ${documentRequestCount} documentos pedidos en seguimiento`}
            count={documentRequestCount}
            href='/dashboard/seguimiento?kind=document_request'
            label='Documentos pedidos'
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
              size='sm'
              className={cn('shrink-0', ROW_ACTION_CLASS)}
            >
              <Link
                href={`/dashboard/product/${item.property.engagementId}`}
                aria-label={`Abrir actividad: ${getActivityTitle(item)}`}
              >
                Abrir
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
              size='sm'
              className={cn('shrink-0', ROW_ACTION_CLASS)}
            >
              <Link
                href={`/dashboard/product/${product.id}`}
                aria-label={`Abrir propiedad: ${product.property.title || 'Propiedad sin título'}`}
              >
                Abrir
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
  properties
}: {
  isLoading: boolean;
  properties: PropertyInsight[];
}) {
  return (
    <Card className='py-0'>
      <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <CardTitle role='heading' aria-level={2}>
            Propiedades con más movimiento
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            Lectura rápida basada en las actividades recientes cargadas en Seguimiento.
          </p>
        </div>
        <Badge variant='outline' className='w-fit rounded-full bg-muted/40'>
          Últimas {ACTIVITY_PREVIEW_SIZE} actividades
        </Badge>
      </CardHeader>
      <CardContent className='p-5'>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : properties.length === 0 ? (
          <EmptyPanel
            icon={Icons.product}
            title='Sin actividad para comparar'
            description='Cuando se registren movimientos, vas a ver qué propiedades concentraron más actividad reciente.'
          />
        ) : (
          <ol className='space-y-3'>
            {properties.map((insight) => (
              <li
                key={insight.property.engagementId}
                className='rounded-2xl border bg-muted/20 p-3'
              >
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0 space-y-1'>
                    <p className='truncate font-medium'>{getPropertyTitle(insight.property)}</p>
                    <p className='text-sm text-muted-foreground'>
                      {formatCount(
                        insight.activityCount,
                        'actividad reciente',
                        'actividades recientes'
                      )}
                      {insight.documentRequestCount > 0
                        ? ` · ${formatCount(insight.documentRequestCount, 'documento', 'documentos')}`
                        : null}
                    </p>
                    <p className='truncate text-sm text-muted-foreground'>
                      Último: {insight.latestTitle}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant='outline'
                    size='sm'
                    className={cn('shrink-0', ROW_ACTION_CLASS)}
                  >
                    <Link
                      href={`/dashboard/product/${insight.property.engagementId}`}
                      aria-label={`Abrir propiedad ${getPropertyTitle(insight.property)}`}
                    >
                      Abrir
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
  sellers
}: {
  isLoading: boolean;
  sellers: SellerInsight[];
}) {
  return (
    <Card className='py-0'>
      <CardHeader className='flex flex-col gap-2 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <CardTitle role='heading' aria-level={2}>
            Vendedores con más movimiento
          </CardTitle>
          <p className='mt-1 text-sm text-muted-foreground'>
            Quiénes están generando actividad en las últimas gestiones registradas.
          </p>
        </div>
        <Badge variant='outline' className='w-fit rounded-full bg-muted/40'>
          Últimas {ACTIVITY_PREVIEW_SIZE} actividades
        </Badge>
      </CardHeader>
      <CardContent className='p-5'>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : sellers.length === 0 ? (
          <EmptyPanel
            icon={Icons.profile}
            title='Sin movimientos de vendedores'
            description='Cuando el equipo registre movimientos manuales, vas a ver la actividad reciente por vendedor.'
          />
        ) : (
          <ol className='space-y-3'>
            {sellers.map((seller) => (
              <li key={seller.id} className='rounded-2xl border bg-muted/20 p-3'>
                <div className='flex items-center justify-between gap-3'>
                  <div className='min-w-0 space-y-1'>
                    <p className='truncate font-medium'>{seller.name}</p>
                    <p className='truncate text-sm text-muted-foreground'>{seller.email}</p>
                    <p className='text-sm text-muted-foreground'>
                      {formatCount(seller.movementCount, 'movimiento', 'movimientos')} ·{' '}
                      {formatCount(
                        seller.propertyIds.size,
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
                      href={`/dashboard/seguimiento?sellerId=${encodeURIComponent(seller.id)}`}
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

function getRecentPropertyInsights(items: ActivityFeedItem[]) {
  const insights = new Map<string, PropertyInsight>();

  for (const item of items) {
    const key = item.property.engagementId;
    const existing = insights.get(key);
    const latestTitle = getActivityTitle(item);

    if (!existing) {
      insights.set(key, {
        activityCount: 1,
        documentRequestCount: item.kind === 'document_request' ? 1 : 0,
        latestAt: item.createdAt,
        latestTitle,
        movementCount: item.kind === 'movement' ? 1 : 0,
        property: item.property
      });
      continue;
    }

    existing.activityCount += 1;
    existing.movementCount += item.kind === 'movement' ? 1 : 0;
    existing.documentRequestCount += item.kind === 'document_request' ? 1 : 0;

    if (isAfter(item.createdAt, existing.latestAt)) {
      existing.latestAt = item.createdAt;
      existing.latestTitle = latestTitle;
      existing.property = item.property;
    }
  }

  return [...insights.values()].toSorted((a, b) => {
    if (b.activityCount !== a.activityCount) {
      return b.activityCount - a.activityCount;
    }

    return Date.parse(b.latestAt) - Date.parse(a.latestAt);
  });
}

function getSellerMovementInsights(items: ActivityFeedItem[]) {
  const insights = new Map<string, SellerInsight>();

  for (const item of items) {
    if (item.kind !== 'movement') {
      continue;
    }

    const sellerId = item.createdBy.id;
    const existing = insights.get(sellerId);

    if (!existing) {
      insights.set(sellerId, {
        email: item.createdBy.email,
        id: sellerId,
        latestAt: item.createdAt,
        movementCount: 1,
        name: item.createdBy.firstName || item.createdBy.email,
        propertyIds: new Set([item.property.engagementId])
      });
      continue;
    }

    existing.movementCount += 1;
    existing.propertyIds.add(item.property.engagementId);

    if (isAfter(item.createdAt, existing.latestAt)) {
      existing.latestAt = item.createdAt;
    }
  }

  return [...insights.values()].toSorted((a, b) => {
    if (b.movementCount !== a.movementCount) {
      return b.movementCount - a.movementCount;
    }

    return Date.parse(b.latestAt) - Date.parse(a.latestAt);
  });
}

function getActivityTitle(item: ActivityFeedItem) {
  if (item.kind === 'document_request') {
    return item.documentRequest.title;
  }

  return item.observation;
}

function getActivityDescription(item: ActivityFeedItem) {
  const propertyTitle = getPropertyTitle(item.property);

  if (item.kind === 'document_request') {
    return `Solicitud documental en ${propertyTitle}`;
  }

  return item.nextStep ? `${propertyTitle} · Próximo paso: ${item.nextStep}` : propertyTitle;
}

function getPropertyTitle(property: ActivityFeedItem['property']) {
  return property.title || property.addressLine || 'Propiedad sin título';
}

function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function isAfter(candidate: string, current: string) {
  return Date.parse(candidate) > Date.parse(current);
}
