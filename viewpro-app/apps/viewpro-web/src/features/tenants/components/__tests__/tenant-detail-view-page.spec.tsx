/**
 * RED — TenantDetailViewPage container tests (platform-tenant-tracking PR2, T-20/23)
 * Spec: "Tenant detail page", "Summary fetch fails", "Loading more activity"
 *
 * Tests cover:
 *   - Loading → skeleton (not stat cards, not an error)
 *   - Success → stat cards render the real counts from the fixture summary
 *   - Success → activity items render as a list, newest-first per fixture order
 *   - Empty activity (activity.items: []) → the empty state, no list
 *   - Error 404 → "Inmobiliaria no encontrada" copy
 *   - Error 502 → InmoView-unreachable copy
 *   - Error generic (500) → getApiErrorMessage fallback copy
 *   - "Cargar más" fetches the NEXT page (offset = current items length) and
 *     APPENDS the new items WITHOUT re-fetching/overwriting the counts (stat
 *     cards keep showing the FIRST page's counts even though the mocked
 *     second response returns different counts — proves counts are not
 *     re-derived from the load-more response)
 *   - "Cargar más" disappears once every item has been loaded (items.length >= total)
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { TenantDetailResponse } from '@/features/tenants/api/types';

// Mock the api service — queries.ts is real and delegates to this mock
// (mirrors tenants-management-page.spec.tsx's convention).
vi.mock('@/features/tenants/api/service', () => ({
  getTenantDetail: vi.fn()
}));

import { getTenantDetail } from '@/features/tenants/api/service';
import { TenantDetailViewPage } from '../tenant-detail-view-page';

const mockGetTenantDetail = vi.mocked(getTenantDetail);

const PAGE_1_RESPONSE: TenantDetailResponse = {
  window: { from: '2026-07-13T00:00:00.000Z', to: '2026-07-20T00:00:00.000Z' },
  activeEngagements: 12,
  activeEngagementsWithOwnerVisibleUpdate: 8,
  activeEngagementUpdatePercentage: 67,
  documentEvents: { requested: 5, uploaded: 4, approved: 3, rejected: 1 },
  ownerViewedPropertyCount: 20,
  activity: {
    total: 3,
    items: [
      { kind: 'movement', id: 'movement-1', createdAt: '2026-07-15T10:00:00.000Z' },
      {
        kind: 'document_request',
        id: 'document-request:doc-1',
        createdAt: '2026-07-14T09:00:00.000Z'
      }
    ]
  }
};

// The load-more response intentionally carries DIFFERENT top-level counts —
// this proves the stat cards keep rendering PAGE_1_RESPONSE's counts and
// never re-derive from a later page (the endpoint always returns counts
// alongside activity, but the UI must ignore them after the first load).
const PAGE_2_RESPONSE: TenantDetailResponse = {
  ...PAGE_1_RESPONSE,
  activeEngagements: 999,
  activity: {
    total: 3,
    items: [{ kind: 'movement', id: 'movement-3', createdAt: '2026-07-13T08:00:00.000Z' }]
  }
};

const EMPTY_RESPONSE: TenantDetailResponse = {
  ...PAGE_1_RESPONSE,
  activity: { total: 0, items: [] }
};

function renderDetailPage(tenantId = 'tenant-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TenantDetailViewPage tenantId={tenantId} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('TenantDetailViewPage — loading state', () => {
  it('renders a skeleton while fetching (not stat cards, not an error)', () => {
    mockGetTenantDetail.mockReturnValue(new Promise(() => {}));

    renderDetailPage();

    expect(screen.getByTestId('tenant-detail-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('tenant-detail-error')).toBeNull();
    expect(screen.queryByTestId('stat-active-engagements')).toBeNull();
  });
});

// ─── Success ──────────────────────────────────────────────────────────────────

describe('TenantDetailViewPage — success', () => {
  it('renders stat cards with the real counts from the fixture summary', async () => {
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_1_RESPONSE);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId('stat-active-engagements').textContent).toBe('12');
    });
    expect(screen.getByTestId('stat-engagements-with-update').textContent).toContain('8');
    expect(screen.getByTestId('stat-owner-views').textContent).toBe('20');
  });

  it('renders each activity item in the merged feed', async () => {
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_1_RESPONSE);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenant-activity-list')).toBeTruthy();
    });
    expect(screen.getByTestId('tenant-activity-item-movement-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-document-request:doc-1')).toBeTruthy();
  });

  it('fetches the first page with offset=0', async () => {
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_1_RESPONSE);

    renderDetailPage('tenant-1');

    await waitFor(() => {
      expect(mockGetTenantDetail).toHaveBeenCalledWith('tenant-1', 0, expect.any(Number));
    });
  });
});

// ─── Empty activity ───────────────────────────────────────────────────────────

describe('TenantDetailViewPage — empty activity', () => {
  it('renders the empty state and no activity list when activity.items is []', async () => {
    mockGetTenantDetail.mockResolvedValueOnce(EMPTY_RESPONSE);

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenant-activity-empty')).toBeTruthy();
    });
    expect(screen.queryByTestId('tenant-activity-list')).toBeNull();
    expect(screen.getByText(/sin actividad todavía/i)).toBeTruthy();
  });
});

// ─── Error states ─────────────────────────────────────────────────────────────

describe('TenantDetailViewPage — error states', () => {
  it('a 404 renders "Inmobiliaria no encontrada"', async () => {
    mockGetTenantDetail.mockRejectedValueOnce({ status: 404, message: 'Tenant not found' });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenant-detail-error')).toBeTruthy();
    });
    expect(screen.getByText(/inmobiliaria no encontrada/i)).toBeTruthy();
  });

  it('a 502 renders the InmoView-unreachable copy', async () => {
    mockGetTenantDetail.mockRejectedValueOnce({ status: 502, message: 'Bad gateway' });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenant-detail-error')).toBeTruthy();
    });
    expect(screen.getByText(/inmoview no responde/i)).toBeTruthy();
  });

  it('a generic (500) error falls back to getApiErrorMessage copy', async () => {
    mockGetTenantDetail.mockRejectedValueOnce({ status: 500, message: 'Internal server error' });

    renderDetailPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenant-detail-error')).toBeTruthy();
    });
    expect(screen.getByText('Internal server error')).toBeTruthy();
  });
});

// ─── Pagination — "Cargar más" ────────────────────────────────────────────────

describe('TenantDetailViewPage — activity pagination ("Cargar más")', () => {
  it('appends the next page and does NOT overwrite the stat-card counts', async () => {
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_1_RESPONSE);
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_2_RESPONSE);

    const user = userEvent.setup();
    renderDetailPage('tenant-1');

    await waitFor(() => {
      expect(screen.getByTestId('tenant-activity-item-movement-1')).toBeTruthy();
    });
    expect(screen.getByTestId('stat-active-engagements').textContent).toBe('12');

    await user.click(screen.getByRole('button', { name: /cargar más/i }));

    await waitFor(() => {
      expect(screen.getByTestId('tenant-activity-item-movement-3')).toBeTruthy();
    });
    // Both earlier items are still present (appended, not replaced).
    expect(screen.getByTestId('tenant-activity-item-movement-1')).toBeTruthy();
    expect(screen.getByTestId('tenant-activity-item-document-request:doc-1')).toBeTruthy();
    // The stat card still reflects the FIRST page's counts (999 from
    // PAGE_2_RESPONSE must never appear).
    expect(screen.getByTestId('stat-active-engagements').textContent).toBe('12');

    expect(mockGetTenantDetail).toHaveBeenNthCalledWith(2, 'tenant-1', 2, expect.any(Number));
  });

  it('"Cargar más" disappears once every activity item has been loaded', async () => {
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_1_RESPONSE);
    mockGetTenantDetail.mockResolvedValueOnce(PAGE_2_RESPONSE);

    const user = userEvent.setup();
    renderDetailPage('tenant-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cargar más/i })).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: /cargar más/i }));

    await waitFor(() => {
      expect(screen.getByTestId('tenant-activity-item-movement-3')).toBeTruthy();
    });
    // total=3 and we now have 3 items loaded → no more pages.
    expect(screen.queryByRole('button', { name: /cargar más/i })).toBeNull();
  });
});
