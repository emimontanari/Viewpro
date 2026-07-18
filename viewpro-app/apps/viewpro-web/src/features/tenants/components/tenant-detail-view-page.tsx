'use client';

// Container (mirrors TenantsManagementPage's D12 split): owns the summary
// query and the local "Cargar más" activity pagination state. Presentational
// children (TenantDetailStatCards/TenantActivityFeed/TenantDetailSkeleton/
// TenantDetailErrorState) are props-in only.
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantDetailOptions } from '@/features/tenants/api/queries';
import { getTenantDetail } from '@/features/tenants/api/service';
import type { TenantActivityItem } from '@/features/tenants/api/types';
import { TenantActivityFeed } from './tenant-activity-feed';
import { TenantDetailErrorState } from './tenant-detail-error-state';
import { TenantDetailSkeleton } from './tenant-detail-skeleton';
import { TenantDetailStatCards } from './tenant-detail-stat-cards';
import styles from './tenant-detail.module.css';

const ACTIVITY_PAGE_SIZE = 20;

type Props = { tenantId: string };

export function TenantDetailViewPage({ tenantId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    ...tenantDetailOptions(tenantId, 0, ACTIVITY_PAGE_SIZE),
    retry: false
  });

  // Activity pagination is owned locally, seeded from the FIRST page's
  // response and never re-synced from it afterwards — "Cargar más" fetches
  // subsequent pages directly via getTenantDetail (bypassing react-query) and
  // only appends `activity.items`, so the stat cards (rendered from `data`
  // below) never re-derive their counts from a later page (D11).
  const [items, setItems] = React.useState<TenantActivityItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  // The backend caps the browsable feed at a fixed depth while `total` keeps
  // reporting the true count, so `items.length < total` alone can leave a
  // "Cargar más" that fetches an empty page. Once a load-more returns zero new
  // items we mark the feed exhausted and hide the button.
  const [reachedEnd, setReachedEnd] = React.useState(false);
  const seededTenantIdRef = React.useRef<string | null>(null);

  if (data && seededTenantIdRef.current !== tenantId) {
    seededTenantIdRef.current = tenantId;
    setItems(data.activity.items);
    setTotal(data.activity.total);
    setReachedEnd(false);
  }

  async function handleLoadMore() {
    if (isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const nextPage = await getTenantDetail(tenantId, items.length, ACTIVITY_PAGE_SIZE);
      setItems((previous) => [...previous, ...nextPage.activity.items]);
      setTotal(nextPage.activity.total);
      if (nextPage.activity.items.length === 0) {
        setReachedEnd(true);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (isLoading) {
    return <TenantDetailSkeleton />;
  }

  if (isError) {
    return <TenantDetailErrorState error={error} />;
  }

  if (!data) {
    return null;
  }

  return (
    <div className={`${styles.page} flex min-h-0 flex-1 flex-col`}>
      <TenantDetailStatCards summary={data} />
      <TenantActivityFeed
        items={items}
        hasMore={items.length < total && !reachedEnd}
        isLoadingMore={isLoadingMore}
        onLoadMore={handleLoadMore}
      />
    </div>
  );
}
