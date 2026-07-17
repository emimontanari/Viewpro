import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for the tenant detail view (platform-tenant-tracking, D9)
 * — mirrors the stat-card grid + activity list shape so the layout doesn't
 * jump once data arrives.
 */
export function TenantDetailSkeleton() {
  return (
    <div data-testid='tenant-detail-skeleton' className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className='h-24 w-full rounded-xl' />
        ))}
      </div>
      <Skeleton className='h-16 w-full rounded-xl' />
      <Skeleton className='h-16 w-full rounded-xl' />
      <Skeleton className='h-16 w-full rounded-xl' />
    </div>
  );
}
