'use client';

/**
 * The three preview lists the dashboard renders.
 */

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@/lib/brand/brand';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import type { DashboardSummaryTopProperty, DashboardSummaryTopSeller } from '@/features/dashboard/api/types';
import type { Product } from '@/features/products/api/types';
import { getAddress, getStatusLabel, getStatusTone } from '@/features/products/components/product-tables/columns';
import { DashboardRowActionLink } from './primitives';
import { EmptyPanel } from './primitives';
import { ListSkeleton } from './primitives';
import { formatCount, getActivityDescription, getActivityTitle, getDashboardPropertyTitle } from './helpers';

export function RecentActivityList({
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
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0 space-y-1'>
              <Badge variant='outline' className='rounded-full bg-background'>
                {item.kind === 'document_request' ? 'Documento' : 'Movimiento'}
              </Badge>
              <p className='line-clamp-2 break-words font-medium'>{getActivityTitle(item)}</p>
              <p className='line-clamp-2 break-words text-sm text-muted-foreground'>
                {getActivityDescription(item)}
              </p>
            </div>
            <DashboardRowActionLink
              href={`/dashboard/product/${item.property.engagementId}`}
              ariaLabel={`Abrir actividad: ${getActivityTitle(item)}`}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PropertyPreviewList({
  emptyDescription = BRAND.dashboardEmptyDescription,
  emptyTitle = 'Sin propiedades activas',
  isLoading,
  products
}: {
  emptyDescription?: string;
  emptyTitle?: string;
  isLoading: boolean;
  products: Product[];
}) {
  if (isLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (products.length === 0) {
    return <EmptyPanel icon={Icons.product} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className='space-y-3'>
      {products.map((product) => (
        <li key={product.id} className='rounded-2xl border bg-muted/20 p-3'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='min-w-0 space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='line-clamp-2 min-w-0 break-words font-medium'>
                  {product.property.title || 'Propiedad sin título'}
                </p>
                <Badge
                  variant='outline'
                  className={cn('rounded-full', getStatusTone(product.status))}
                >
                  {getStatusLabel(product.status)}
                </Badge>
              </div>
              <p className='line-clamp-2 break-words text-sm text-muted-foreground'>
                {getAddress(product)}
              </p>
            </div>
            <DashboardRowActionLink
              href={`/dashboard/product/${product.id}`}
              ariaLabel={`Abrir propiedad: ${product.property.title || 'Propiedad sin título'}`}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TopPropertiesCard({
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
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0 space-y-1'>
                    <p className='line-clamp-2 break-words font-medium'>
                      {getDashboardPropertyTitle(insight)}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {formatCount(insight.movementCount, 'movimiento', 'movimientos')}
                      {insight.documentRequestCount > 0
                        ? ` · ${formatCount(insight.documentRequestCount, 'documento', 'documentos')}`
                        : null}
                    </p>
                    <p className='line-clamp-2 break-words text-sm text-muted-foreground'>
                      Último: {insight.lastActivityTitle}
                    </p>
                  </div>
                  <DashboardRowActionLink
                    href={`/dashboard/product/${insight.engagementId}`}
                    ariaLabel={`Abrir propiedad ${getDashboardPropertyTitle(insight)}`}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export function SellerActivityCard({
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
                <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0 space-y-1'>
                    <p className='line-clamp-2 break-words font-medium'>{seller.name}</p>
                    <p className='line-clamp-1 break-all text-sm text-muted-foreground'>
                      {seller.email}
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {formatCount(seller.movementCount, 'movimiento', 'movimientos')} ·{' '}
                      {formatCount(
                        seller.touchedPropertiesCount,
                        'propiedad tocada',
                        'propiedades tocadas'
                      )}
                    </p>
                  </div>
                  <DashboardRowActionLink
                    href={`/dashboard/seguimiento?sellerId=${encodeURIComponent(seller.userId)}`}
                    ariaLabel={`Ver movimientos de ${seller.name}`}
                    label='Ver'
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
