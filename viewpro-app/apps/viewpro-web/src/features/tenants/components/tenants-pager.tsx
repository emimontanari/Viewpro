'use client';

import { Button } from '@/components/ui/button';

type Props = {
  offset: number;
  limit: number;
  total: number;
  disabled?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Offset/limit pager (D5/D13). `limit` is fixed by the caller and never
 * requested above the API's 200 cap (invariant). `disabled` blocks paging while
 * a status/limits mutation is in flight so the page cannot change underneath it.
 */
export function TenantsPager({ offset, limit, total, disabled = false, onPrev, onNext }: Props) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canGoPrev = offset > 0;
  const canGoNext = offset + limit < total;

  return (
    <div className='flex items-center justify-between gap-4 pt-4'>
      <p className='text-muted-foreground text-sm'>
        Mostrando {from}–{to} de {total}
      </p>
      <div className='flex gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled || !canGoPrev}
          onClick={onPrev}
        >
          Anterior
        </Button>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={disabled || !canGoNext}
          onClick={onNext}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
