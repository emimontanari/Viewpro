import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import type { ActivityFeedItem } from '@/features/activity/api/types';
import { getMovementTypeLabel } from '@/features/products/constants/movement-options';
import { getStatusLabel } from '@/features/products/components/product-tables/columns';
import { PROPERTY_PREVIEW_SIZE, SELLER_ACTIVITY_PREVIEW_SIZE } from './constants';
import { formatArgentinaActivityTime, getDashboardEngagementHref } from './helpers';
import type { SellerActivityState, SellerProductsState } from './seller-home';

type PropertySummary = {
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  title?: string | null;
};

function nonblank(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function getPropertyTitle(property: PropertySummary) {
  return nonblank(property.title) ?? 'Propiedad sin título';
}

function getPropertyAddress(property: PropertySummary) {
  const parts = [property.addressLine, property.city, property.province].flatMap(
    (value) => nonblank(value) ?? []
  );

  return parts.length ? parts.join(', ') : 'Dirección no informada';
}

function getSafeEngagementHref(engagementId: unknown, itemTenantId: string, tenantId: string) {
  if (itemTenantId !== tenantId || typeof engagementId !== 'string') return null;
  return getDashboardEngagementHref(engagementId);
}

export function SellerPropertyList({ state }: { state: SellerProductsState }) {
  if (!('data' in state)) return null;

  const { items, total } = state.data;

  if (!items.length) {
    return total === 0 ? (
      <SellerListEmpty
        description='No hay gestiones asignadas en esta vista.'
        title='Sin propiedades asignadas'
      />
    ) : (
      <SellerListEmpty
        description='La cantidad asignada es mayor a cero, pero esta vista no tiene filas para mostrar.'
        title='No hay gestiones para mostrar en esta vista'
      />
    );
  }

  return (
    <ol className='space-y-3'>
      {items.slice(0, PROPERTY_PREVIEW_SIZE).map((product, index) => {
        const title = getPropertyTitle(product.property);
        const href = getSafeEngagementHref(product.id, product.tenantId, state.tenantId);

        return (
          <li key={product.id || index} className='rounded-2xl border bg-muted/20 p-3'>
            <div className='min-w-0 space-y-1'>
              <div className='flex flex-wrap items-center gap-2'>
                <p className='break-words font-medium'>{title}</p>
                <Badge className='rounded-full bg-background' variant='outline'>
                  {getStatusLabel(product.status)}
                </Badge>
              </div>
              <p className='break-words text-sm text-muted-foreground'>
                {getPropertyAddress(product.property)}
              </p>
              {href ? <SellerDetailLink href={href} label={`Abrir propiedad: ${title}`} /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SellerActivityList({ state }: { state: SellerActivityState }) {
  if (!('data' in state)) return null;

  if (!state.data.items.length) {
    return (
      <SellerListEmpty
        description='No hay movimientos ni solicitudes documentales permitidos para mostrar.'
        title='Sin actividad reciente'
      />
    );
  }

  return (
    <ol className='space-y-3'>
      {state.data.items.slice(0, SELLER_ACTIVITY_PREVIEW_SIZE).map((item, index) => {
        const title = getPropertyTitle(item.property);
        const href = getSafeEngagementHref(item.property.engagementId, item.tenantId, state.tenantId);
        const timestamp = nonblank(item.createdAt) ? formatArgentinaActivityTime(item.createdAt) : null;

        return (
          <li key={item.id || index} className='rounded-2xl border bg-muted/20 p-3'>
            <div className='min-w-0 space-y-1'>
              {item.kind === 'movement' ? <MovementContent item={item} /> : <DocumentRequestContent item={item} />}
              <p className='break-words text-sm text-muted-foreground'>
                {title} · {getPropertyAddress(item.property)}
              </p>
              {timestamp ? <time dateTime={timestamp.dateTime}>{timestamp.label}</time> : <p>Fecha no disponible</p>}
              {href ? <SellerDetailLink href={href} label={`Abrir actividad: ${title}`} /> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function MovementContent({ item }: { item: Extract<ActivityFeedItem, { kind: 'movement' }> }) {
  const observation = nonblank(item.observation) ?? 'Observación no informada';

  return (
    <>
      <Badge className='rounded-full bg-background' variant='outline'>
        {getMovementTypeLabel(item.type)}
      </Badge>
      <p className='break-words font-medium'>{observation}</p>
      {nonblank(item.nextStep) ? (
        <p className='break-words text-sm text-muted-foreground'>Próximo paso informado: {item.nextStep}</p>
      ) : null}
    </>
  );
}

function DocumentRequestContent({ item }: { item: Extract<ActivityFeedItem, { kind: 'document_request' }> }) {
  const title = nonblank(item.documentRequest.title) ?? 'Solicitud documental sin título';

  return (
    <>
      <Badge className='rounded-full bg-background' variant='outline'>
        Solicitud documental
      </Badge>
      <p className='break-words font-medium'>{title}</p>
      {nonblank(item.documentRequest.description) ? (
        <p className='break-words text-sm text-muted-foreground'>
          Descripción: {item.documentRequest.description}
        </p>
      ) : null}
    </>
  );
}

function SellerDetailLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className='inline-flex min-h-11 items-center font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      href={href}
    >
      {label}
    </Link>
  );
}

function SellerListEmpty({ description, title }: { description: string; title: string }) {
  return (
    <div className='rounded-2xl border border-dashed p-4'>
      <p className='font-medium'>{title}</p>
      <p className='mt-1 text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}
