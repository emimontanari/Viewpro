import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import type { TenantActivityItem } from '@/features/tenants/api/types';
import {
  describeTenantActivityItem,
  formatActivityTimestamp
} from '@/features/tenants/lib/activity-feed-formatting';

type Props = {
  items: TenantActivityItem[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

/**
 * Merged (Movement + DocumentRequest) activity feed for the tenant detail
 * view (platform-tenant-tracking, D9/D11). A plain timeline list — each item
 * shows a derived title/subtitle (see activity-feed-formatting.ts) and its
 * timestamp formatted es-AR. "Cargar más" appends the next offset/limit page;
 * it is owned by the parent (TenantDetailViewPage) so counts never re-fetch.
 */
export function TenantActivityFeed({ items, hasMore, isLoadingMore, onLoadMore }: Props) {
  if (items.length === 0) {
    return (
      <div
        data-testid='tenant-activity-empty'
        className='text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm'
      >
        Sin actividad todavía.
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      <ol data-testid='tenant-activity-list' className='flex flex-col gap-3'>
        {items.map((item) => {
          const { title, subtitle } = describeTenantActivityItem(item);

          return (
            <li
              key={item.id}
              data-testid={`tenant-activity-item-${item.id}`}
              className='rounded-lg border p-3'
            >
              <div className='flex items-center justify-between gap-2'>
                <p className='font-medium'>{title}</p>
                <span className='text-muted-foreground text-xs whitespace-nowrap'>
                  {formatActivityTimestamp(item.createdAt)}
                </span>
              </div>
              <p className='text-muted-foreground text-sm'>{subtitle}</p>
            </li>
          );
        })}
      </ol>
      {hasMore && (
        <Button variant='outline' disabled={isLoadingMore} onClick={onLoadMore}>
          {isLoadingMore ? (
            <>
              <Icons.spinner className='mr-2 h-4 w-4 animate-spin' /> Cargando...
            </>
          ) : (
            'Cargar más'
          )}
        </Button>
      )}
    </div>
  );
}
