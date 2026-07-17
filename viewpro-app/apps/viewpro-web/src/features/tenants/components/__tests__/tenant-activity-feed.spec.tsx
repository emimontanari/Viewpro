/**
 * Client-side behavior for the redesigned tenant activity feed
 * (feat/web-tenant-detail-redesign). Presentation-only: the same items render
 * with the same titles; these tests exercise the NEW local-state category
 * filter, the visible-count label, aria-pressed, date separators, and confirm
 * the filter composes with "Cargar más" WITHOUT any fetch (the feed receives
 * items purely via props).
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { TenantActivityItem } from '@/features/tenants/api/types';
import { TenantActivityFeed } from '../tenant-activity-feed';

// Two calendar days, one item of each category:
//  - membership (user)      2026-07-15
//  - movement STATUS_CHANGE (update)   2026-07-15
//  - movement INQUIRY (inquiry)        2026-07-14
//  - document_request (deed)           2026-07-14
const ITEMS: TenantActivityItem[] = [
  {
    kind: 'membership',
    id: 'user-1',
    membershipEvent: 'INVITED',
    subject: { firstName: 'Ana' },
    actor: { firstName: 'Ops' },
    createdAt: '2026-07-15T12:00:00.000Z'
  },
  {
    kind: 'movement',
    id: 'update-1',
    type: 'STATUS_CHANGE',
    createdAt: '2026-07-15T10:00:00.000Z'
  },
  {
    kind: 'movement',
    id: 'inquiry-1',
    type: 'INQUIRY',
    createdAt: '2026-07-14T10:00:00.000Z'
  },
  {
    kind: 'document_request',
    id: 'deed-1',
    createdAt: '2026-07-14T09:00:00.000Z'
  }
];

function renderFeed(overrides: Partial<React.ComponentProps<typeof TenantActivityFeed>> = {}) {
  const props = {
    items: ITEMS,
    hasMore: false,
    isLoadingMore: false,
    onLoadMore: vi.fn(),
    ...overrides
  };
  render(<TenantActivityFeed {...props} />);
  return props;
}

describe('TenantActivityFeed — category filter', () => {
  it('shows all items and all filter chips by default ("Todos" active)', () => {
    renderFeed();

    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-update-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-inquiry-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-deed-1')).toBeTruthy();

    expect(screen.getByTestId('tenant-activity-filter-all').getAttribute('aria-pressed')).toBe(
      'true'
    );
  });

  it('filtering by "Usuarios" shows only membership items and hides the rest', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));

    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-update-1')).toBeNull();
    expect(screen.queryByTestId('tenant-activity-item-inquiry-1')).toBeNull();
    expect(screen.queryByTestId('tenant-activity-item-deed-1')).toBeNull();
  });

  it('filtering by "Escrituras" shows only document_request items', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-deed'));

    expect(screen.getByTestId('tenant-activity-item-deed-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-user-1')).toBeNull();
    expect(screen.queryByTestId('tenant-activity-item-inquiry-1')).toBeNull();
  });

  it('filtering by "Consultas" shows only INQUIRY movements', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-inquiry'));

    expect(screen.getByTestId('tenant-activity-item-inquiry-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-update-1')).toBeNull();
  });

  it('filtering by "Actualizaciones" shows non-inquiry movements', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-update'));

    expect(screen.getByTestId('tenant-activity-item-update-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-inquiry-1')).toBeNull();
  });

  it('"Todos" restores every item after another filter was active', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    expect(screen.queryByTestId('tenant-activity-item-deed-1')).toBeNull();

    await user.click(screen.getByTestId('tenant-activity-filter-all'));
    expect(screen.getByTestId('tenant-activity-item-deed-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
  });

  it('reflects the active chip via aria-pressed', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));

    expect(screen.getByTestId('tenant-activity-filter-user').getAttribute('aria-pressed')).toBe(
      'true'
    );
    expect(screen.getByTestId('tenant-activity-filter-all').getAttribute('aria-pressed')).toBe(
      'false'
    );
  });
});

describe('TenantActivityFeed — visible-count label', () => {
  it('shows the total event count by default', () => {
    renderFeed();
    expect(screen.getByText('(4 eventos)')).toBeTruthy();
  });

  it('updates the count to the visible items after filtering', async () => {
    const user = userEvent.setup();
    renderFeed();

    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    expect(screen.getByText('(1 evento)')).toBeTruthy();
  });
});

describe('TenantActivityFeed — date separators', () => {
  it('renders a day-separator heading per distinct calendar day', () => {
    renderFeed();
    // Level-3 headings are the per-day separators (the section title is h2).
    const separators = screen.getAllByRole('heading', { level: 3 });
    // Two distinct days across the fixture (2026-07-15 and 2026-07-14).
    expect(separators.length).toBe(2);
  });

  it('only renders separators for days that still have visible items after filtering', async () => {
    const user = userEvent.setup();
    renderFeed();

    // "Usuarios" leaves a single item on 2026-07-15 → exactly one separator.
    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    expect(screen.getAllByRole('heading', { level: 3 }).length).toBe(1);
  });
});

describe('TenantActivityFeed — "Cargar más" composition (no fetch)', () => {
  it('keeps the filter active and calls the parent-provided onLoadMore (no internal fetch)', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    renderFeed({ hasMore: true, onLoadMore });

    await user.click(screen.getByTestId('tenant-activity-filter-user'));
    await user.click(screen.getByRole('button', { name: /cargar más/i }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    // Filter is still applied (still only the membership item shows).
    expect(screen.getByTestId('tenant-activity-item-user-1')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-item-deed-1')).toBeNull();
  });

  it('renders the empty state (not the list) when there are no items at all', () => {
    renderFeed({ items: [] });
    expect(screen.getByTestId('tenant-activity-empty')).toBeTruthy();
    expect(screen.queryByTestId('tenant-activity-list')).toBeNull();
  });
});
