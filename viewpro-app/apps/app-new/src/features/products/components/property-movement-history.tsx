import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';
import type { ProductMovement } from '../api/types';
import { getMovementTypeLabel } from '../constants/movement-options';
import { formatDateTime } from '../utils/format-date-time';
import { getStatusLabel } from './product-tables/columns';

export function PropertyMovementHistory({
  isError,
  isLoading,
  movements
}: {
  isError: boolean;
  isLoading: boolean;
  movements: ProductMovement[];
}) {
  return (
    <section className='space-y-3'>
      <div>
        <h3 className='text-base font-semibold'>Historial reciente</h3>
        <p className='text-sm text-muted-foreground'>
          Últimos movimientos registrados para esta propiedad.
        </p>
      </div>

      <div className='rounded-2xl border bg-card p-4 shadow-xs'>
        {isLoading ? <MovementHistoryLoadingState /> : null}
        {isError ? <MovementHistoryErrorState /> : null}
        {!isLoading && !isError && movements.length === 0 ? <MovementHistoryEmptyState /> : null}
        {!isLoading && !isError && movements.length > 0 ? (
          <ol className='space-y-3'>
            {movements.map((movement) => (
              <MovementHistoryItem key={movement.id} movement={movement} />
            ))}
          </ol>
        ) : null}
      </div>
    </section>
  );
}

function MovementHistoryLoadingState() {
  return (
    <div className='space-y-3' aria-label='Cargando historial'>
      {[0, 1, 2].map((item) => (
        <div key={item} className='flex gap-3'>
          <div className='size-9 animate-pulse rounded-full bg-muted' />
          <div className='flex-1 space-y-2'>
            <div className='h-4 w-40 animate-pulse rounded bg-muted' />
            <div className='h-3 w-full max-w-lg animate-pulse rounded bg-muted' />
          </div>
        </div>
      ))}
    </div>
  );
}

function MovementHistoryErrorState() {
  return (
    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
      No se pudo cargar el historial de movimientos.
    </div>
  );
}

function MovementHistoryEmptyState() {
  return (
    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
      Todavía no hay movimientos registrados para esta propiedad.
    </div>
  );
}

function MovementHistoryItem({ movement }: { movement: ProductMovement }) {
  const statusChange = getMovementStatusChange(movement);

  return (
    <li className='flex gap-3 rounded-xl border bg-background p-3'>
      <div className='mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        <Icons.clock className='size-4' />
      </div>
      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline' className='rounded-full bg-muted/40'>
              {getMovementTypeLabel(movement.type)}
            </Badge>
            {statusChange ? (
              <span className='text-xs font-medium text-muted-foreground'>{statusChange}</span>
            ) : null}
          </div>
          <time className='text-xs text-muted-foreground' dateTime={movement.createdAt}>
            {formatDateTime(movement.createdAt)}
          </time>
        </div>
        <p className='break-words text-sm'>{movement.observation}</p>
        <div className='flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
          <span>{formatMovementActor(movement)}</span>
          {movement.nextStep ? <span>Próximo paso: {movement.nextStep}</span> : null}
        </div>
      </div>
    </li>
  );
}

function getMovementStatusChange(movement: ProductMovement) {
  if (!movement.newStatus) {
    return null;
  }

  const previousStatus = movement.previousStatus
    ? getStatusLabel(movement.previousStatus)
    : 'Sin estado anterior';

  return `${previousStatus} → ${getStatusLabel(movement.newStatus)}`;
}

function formatMovementActor(movement: ProductMovement) {
  const actor = movement.createdBy.firstName || movement.createdBy.email;
  return actor ? `Registrado por ${actor}` : 'Movimiento registrado';
}
