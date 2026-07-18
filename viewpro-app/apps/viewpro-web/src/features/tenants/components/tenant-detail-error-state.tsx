import { getApiErrorMessage, isApiError } from '@/lib/api-client';

const NOT_FOUND_MESSAGE = 'Inmobiliaria no encontrada.';
const UPSTREAM_UNAVAILABLE_MESSAGE = 'No se pudo cargar la actividad: InmoView no responde.';

type Props = { error: unknown };

/**
 * Error state for the tenant detail view (platform-tenant-tracking, D9). Maps
 * the passthrough's two documented failure statuses to specific Spanish copy
 * (404 unknown tenant; 502 InmoView unreachable — TenantDetailService's error
 * mapping in apps/viewpro-api) and falls back to the generic API-error
 * message for everything else.
 */
export function TenantDetailErrorState({ error }: Props) {
  const message = isApiError(error) && error.status === 404
    ? NOT_FOUND_MESSAGE
    : isApiError(error) && error.status === 502
      ? UPSTREAM_UNAVAILABLE_MESSAGE
      : getApiErrorMessage(error);

  return (
    <div
      data-testid='tenant-detail-error'
      className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
    >
      <p className='text-destructive font-semibold'>No se pudo cargar la inmobiliaria</p>
      <p className='text-muted-foreground mt-1 text-sm'>{message}</p>
    </div>
  );
}
