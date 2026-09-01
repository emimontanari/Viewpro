import type { DashboardSummaryRange } from '@/features/dashboard/api/types';

/**
 * Values the container and its presentational pieces both need.
 */

export const PROPERTY_PREVIEW_SIZE = 6;

export const SELLER_ACTIVITY_PREVIEW_SIZE = 6;

export const ROW_ACTION_CLASS =
  'min-h-10 w-full justify-center rounded-xl border bg-background shadow-xs sm:size-8 sm:min-h-8 sm:w-8 sm:rounded-full sm:p-0';

export const RANGE_OPTIONS: Array<{ label: string; range: DashboardSummaryRange; days: number }> = [
  { label: '7 días', range: '7d', days: 7 },
  { label: '14 días', range: '14d', days: 14 },
  { label: '30 días', range: '30d', days: 30 }
];
