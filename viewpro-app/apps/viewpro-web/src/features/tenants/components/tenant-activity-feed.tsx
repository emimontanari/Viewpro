'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Icons } from '@/components/icons';
import type { TenantActivityItem } from '@/features/tenants/api/types';
import {
  activityDayKey,
  buildTenantActivityDetail,
  categorizeActivityItem,
  describeTenantActivityItem,
  formatActivityDateSeparator,
  formatActivityFullTimestamp,
  formatActivityTimestamp,
  type ActivityCategory
} from '@/features/tenants/lib/activity-feed-formatting';
import styles from './tenant-detail.module.css';

type Props = {
  items: TenantActivityItem[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
};

type FilterKey = 'all' | ActivityCategory;

const FILTERS: ReadonlyArray<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'user', label: 'Usuarios' },
  { key: 'deed', label: 'Escrituras' },
  { key: 'update', label: 'Actualizaciones' },
  { key: 'inquiry', label: 'Consultas' }
];

const EVENT_CIRCLE_CLASS: Record<ActivityCategory, string> = {
  user: styles.eventUser,
  deed: styles.eventDeed,
  update: styles.eventUpdate,
  inquiry: styles.eventInquiry
};

const SVG_PROPS = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false
};

function EventIcon({ category }: { category: ActivityCategory }) {
  switch (category) {
    case 'user':
      return (
        <svg {...SVG_PROPS}>
          <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
          <circle cx='9' cy='7' r='4' />
          <line x1='19' y1='8' x2='19' y2='14' />
          <line x1='22' y1='11' x2='16' y2='11' />
        </svg>
      );
    case 'deed':
      return (
        <svg {...SVG_PROPS}>
          <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
          <polyline points='14 2 14 8 20 8' />
          <line x1='16' y1='13' x2='8' y2='13' />
          <line x1='16' y1='17' x2='8' y2='17' />
          <line x1='10' y1='9' x2='8' y2='9' />
        </svg>
      );
    case 'inquiry':
      return (
        <svg {...SVG_PROPS}>
          <path d='M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z' />
        </svg>
      );
    case 'update':
    default:
      return (
        <svg {...SVG_PROPS}>
          <path d='M23 4v6h-6' />
          <path d='M1 20v-6h6' />
          <path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' />
        </svg>
      );
  }
}

function ChevronIcon() {
  return (
    <svg {...SVG_PROPS} className={styles.rowChevron}>
      <polyline points='6 9 12 15 18 9' />
    </svg>
  );
}

type FeedRow =
  | { kind: 'separator'; key: string; label: string }
  | { kind: 'item'; item: TenantActivityItem; category: ActivityCategory };

// Interleaves day separators before the first visible item of each calendar
// day. A separator is only emitted when a day actually has visible items, so
// filtering never leaves an orphaned separator.
function buildRows(items: TenantActivityItem[]): FeedRow[] {
  const rows: FeedRow[] = [];
  let lastDayKey: string | null = null;

  for (const item of items) {
    const dayKey = activityDayKey(item.createdAt);
    if (dayKey !== lastDayKey) {
      lastDayKey = dayKey;
      rows.push({
        kind: 'separator',
        key: `sep-${dayKey}`,
        label: formatActivityDateSeparator(item.createdAt)
      });
    }
    rows.push({ kind: 'item', item, category: categorizeActivityItem(item) });
  }

  return rows;
}

/**
 * Redesigned merged activity feed for the tenant detail view
 * (feat/web-tenant-detail-redesign). Presentation-only: the same items render
 * with the same describeTenantActivityItem titles/subtitles and
 * formatActivityTimestamp timestamps. The category filter is purely local
 * client state (useState) over already-fetched items — it never triggers a
 * fetch and composes with "Cargar más" (newly appended items are re-filtered
 * on the next render).
 */
export function TenantActivityFeed({ items, hasMore, isLoadingMore, onLoadMore }: Props) {
  const [activeFilter, setActiveFilter] = React.useState<FilterKey>('all');

  if (items.length === 0) {
    return (
      <div data-testid='tenant-activity-empty' className={styles.emptyState}>
        Sin actividad todavía.
      </div>
    );
  }

  const visibleItems =
    activeFilter === 'all'
      ? items
      : items.filter((item) => categorizeActivityItem(item) === activeFilter);

  const rows = buildRows(visibleItems);

  return (
    <section className={styles.feedSection}>
      <div className={styles.feedHeader}>
        <h2 className={styles.feedTitle}>Actividad reciente</h2>
        <span className={styles.feedCount}>
          ({visibleItems.length} {visibleItems.length === 1 ? 'evento' : 'eventos'})
        </span>
      </div>

      <div className={styles.chips} role='group' aria-label='Filtrar actividad'>
        {FILTERS.map((filter) => {
          const isActive = activeFilter === filter.key;
          return (
            <button
              key={filter.key}
              type='button'
              data-testid={`tenant-activity-filter-${filter.key}`}
              className={`${styles.chip} ${isActive ? styles.chipActive : ''}`}
              aria-pressed={isActive}
              onClick={() => setActiveFilter(filter.key)}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className={styles.feedCard}>
        {rows.length === 0 ? (
          <p className={styles.filterEmpty}>Sin eventos para este filtro.</p>
        ) : (
          <ul data-testid='tenant-activity-list' className={styles.list}>
            {rows.map((row) => {
              if (row.kind === 'separator') {
                return (
                  <li key={row.key} className={styles.separatorItem}>
                    <h3 className={styles.separator}>{row.label}</h3>
                  </li>
                );
              }

              const { item, category } = row;
              const { title, subtitle } = describeTenantActivityItem(item);
              const detail = buildTenantActivityDetail(item);

              return (
                <li
                  key={item.id}
                  data-testid={`tenant-activity-item-${item.id}`}
                  className={styles.rowItem}
                >
                  <Collapsible>
                    <CollapsibleTrigger className={styles.rowTrigger}>
                      <span className={`${styles.iconCircle} ${EVENT_CIRCLE_CLASS[category]}`}>
                        <EventIcon category={category} />
                      </span>
                      <span className={styles.rowContent}>
                        <span className={styles.rowTitle}>{title}</span>
                        <span className={styles.rowSubtitle}>{subtitle}</span>
                      </span>
                      <span
                        className={styles.timestamp}
                        title={formatActivityFullTimestamp(item.createdAt)}
                      >
                        {formatActivityTimestamp(item.createdAt)}
                      </span>
                      <ChevronIcon />
                    </CollapsibleTrigger>
                    {detail.length > 0 && (
                      <CollapsibleContent className={styles.rowDetail}>
                        <dl className={styles.detailList}>
                          {detail.map((field) => (
                            <div key={field.label} className={styles.detailPair}>
                              <dt className={styles.detailLabel}>{field.label}</dt>
                              <dd className={styles.detailValue}>{field.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {hasMore && (
        <div className={styles.loadMoreWrap}>
          <Button variant='outline' disabled={isLoadingMore} onClick={onLoadMore}>
            {isLoadingMore ? (
              <>
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' /> Cargando...
              </>
            ) : (
              'Cargar más'
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
