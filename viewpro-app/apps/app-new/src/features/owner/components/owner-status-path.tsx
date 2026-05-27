import type { CSSProperties } from 'react';
import { Badge } from '@/components/ui/badge';
import { propertyStatusOptions } from '@/features/products/constants/product-options';
import { cn } from '@/lib/utils';

const CANCELLED_STATUS = 'CANCELLED';
const ACTIVE_STATUS_OPTIONS = propertyStatusOptions.filter(
  (option) => option.value !== CANCELLED_STATUS
);

export function OwnerStatusPath({ status }: { status: string }) {
  const statusOptions = getStatusOptions(status);
  const currentIndex = statusOptions.findIndex((option) => option.value === status);

  return (
    <div className='rounded-2xl border bg-background p-4 shadow-sm sm:p-5'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h2 className='text-lg font-semibold'>Estado de la gestión</h2>
          <p className='text-sm text-muted-foreground'>
            Este caminito muestra en qué etapa está tu propiedad.
          </p>
        </div>
        <Badge
          variant={status === CANCELLED_STATUS ? 'destructive' : 'secondary'}
          className={cn(
            status !== CANCELLED_STATUS &&
              'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200'
          )}
        >
          Estado actual: {getStatusLabel(status)}
        </Badge>
      </div>

      <ol
        className='mt-6 grid gap-0 md:grid-cols-[repeat(var(--owner-status-count),minmax(0,1fr))]'
        style={{ '--owner-status-count': statusOptions.length } as CSSProperties}
      >
        {statusOptions.map((option, index) => {
          const state = getStepState(index, currentIndex);

          return (
            <li key={option.value} className='relative flex gap-3 pb-6 last:pb-0 md:block md:pb-0'>
              <div
                className={cn(
                  'absolute top-5 left-[11px] h-full w-px bg-border md:top-[11px] md:left-1/2 md:h-px md:w-full',
                  index === statusOptions.length - 1 && 'hidden',
                  state === 'completed' && 'bg-purple-400/70 dark:bg-purple-500/60'
                )}
              />
              <div
                className={cn(
                  'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background md:mx-auto',
                  state === 'current' &&
                    'border-purple-400 bg-purple-50 shadow-sm shadow-purple-500/20 dark:border-purple-400/70 dark:bg-purple-500/15'
                )}
              >
                {state === 'current' ? (
                  <span className='absolute size-8 rounded-full bg-purple-500/20 motion-safe:animate-pulse motion-reduce:animate-none' />
                ) : null}
                <span
                  className={cn(
                    'relative size-2.5 rounded-full bg-muted-foreground/40',
                    state === 'completed' && 'bg-purple-500',
                    state === 'current' &&
                      'size-3.5 bg-purple-600 ring-4 ring-purple-500/20 dark:bg-purple-300 dark:ring-purple-300/20'
                  )}
                />
              </div>
              <div className='min-w-0 md:mt-3 md:px-2 md:text-center'>
                <p
                  className={cn(
                    'text-sm font-medium text-muted-foreground',
                    state === 'completed' && 'text-foreground',
                    state === 'current' && 'text-purple-700 dark:text-purple-200'
                  )}
                >
                  {option.label}
                </p>
                {state === 'current' ? (
                  <p className='mt-1 text-xs font-medium text-purple-600 dark:text-purple-300'>
                    Etapa actual
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function getStatusOptions(status: string) {
  if (status === CANCELLED_STATUS) {
    return [...ACTIVE_STATUS_OPTIONS, getKnownStatusOption(CANCELLED_STATUS)];
  }

  if (ACTIVE_STATUS_OPTIONS.some((option) => option.value === status)) {
    return ACTIVE_STATUS_OPTIONS;
  }

  return [...ACTIVE_STATUS_OPTIONS, { value: status, label: getStatusLabel(status) }];
}

function getStepState(index: number, currentIndex: number) {
  if (currentIndex === -1) {
    return 'future';
  }

  if (index < currentIndex) {
    return 'completed';
  }

  if (index === currentIndex) {
    return 'current';
  }

  return 'future';
}

function getKnownStatusOption(status: string) {
  return (
    propertyStatusOptions.find((option) => option.value === status) ?? {
      value: status,
      label: status
    }
  );
}

function getStatusLabel(status: string) {
  return getKnownStatusOption(status).label;
}
