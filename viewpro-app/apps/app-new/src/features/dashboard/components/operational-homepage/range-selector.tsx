'use client';

/**
 * Range picker for the manager summary.
 */

import { Button } from '@/components/ui/button';
import type { DashboardSummaryRange } from '@/features/dashboard/api/types';
import { RANGE_OPTIONS } from './constants';

export function RangeSelector({
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
