/**
 * Dashboard overview page — charts dashboard fed by REAL ViewPro data.
 *
 * The page fetches MetricsSummary + the tenant list and hands them to the
 * presentational OverviewDashboard. It owns loading / error / success states:
 *   - either query loading            → skeleton (not an error)
 *   - either query errors (non-401)   → inline error card
 *   - both succeed                    → OverviewDashboard with real data
 *
 * Read-only: no mutation controls are rendered.
 */
import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { MetricsSummary } from '@/features/metrics/api/types';
import type { TenantListItem, TenantListResponse } from '@/features/tenants/api/types';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/features/metrics/api/queries', () => ({
  metricsSummaryOptions: {
    queryKey: ['metrics', 'summary'],
    queryFn: vi.fn()
  }
}));

vi.mock('@/features/tenants/api/queries', () => ({
  tenantsListOptions: (offset: number, limit: number) => ({
    queryKey: ['tenants', 'list', offset, limit],
    queryFn: mockGetTenantList
  })
}));

vi.mock('@/features/metrics/api/service', () => ({
  getMetricsSummary: vi.fn()
}));

// Isolate the page from the dashboard rendering (recharts etc.)
vi.mock('@/features/overview/components/overview-dashboard', () => ({
  OverviewDashboard: ({ metrics, tenants }: { metrics: MetricsSummary; tenants: TenantListItem[] }) => (
    <div data-testid='overview-dashboard'>
      <span data-testid='dash-tenants'>{metrics.tenants}</span>
      <span data-testid='dash-list-len'>{tenants.length}</span>
    </div>
  )
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams()
}));

import { getMetricsSummary } from '@/features/metrics/api/service';
import { metricsSummaryOptions } from '@/features/metrics/api/queries';
import DashboardPage from '../page';

const mockGetMetricsSummary = vi.mocked(getMetricsSummary);
const mockGetTenantList = vi.fn<(offset: number, limit: number) => Promise<TenantListResponse>>();
const mockOptions = vi.mocked(metricsSummaryOptions) as unknown as {
  queryKey: string[];
  queryFn: ReturnType<typeof vi.fn>;
};

const MOCK_SUMMARY: MetricsSummary = {
  tenants: 3,
  byStatus: { ACTIVE: 2, TRIAL: 1 },
  generatedAt: '2026-07-15T10:00:00.000Z'
};

const MOCK_LIST: TenantListResponse = {
  total: 3,
  items: [
    {
      id: '1',
      name: 'A',
      slug: 'a',
      status: 'ACTIVE',
      limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null },
      trialEndsAt: null,
      plan: 'BASICO'
    }
  ]
};

function renderPage(qc: QueryClient) {
  return render(
    <QueryClientProvider client={qc}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockOptions.queryFn = mockGetMetricsSummary;
});

// ─── Loading ────────────────────────────────────────────────────────────────

describe('DashboardPage — loading state', () => {
  it('renders skeleton while queries are loading (not an error)', () => {
    mockGetMetricsSummary.mockReturnValue(new Promise(() => {}));
    mockGetTenantList.mockReturnValue(new Promise(() => {}));

    renderPage(newClient());

    expect(screen.getByTestId('overview-loading-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('overview-error')).toBeNull();
  });
});

// ─── Success ────────────────────────────────────────────────────────────────

describe('DashboardPage — success state', () => {
  it('renders OverviewDashboard with real metrics + tenant data', async () => {
    mockGetMetricsSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetTenantList.mockResolvedValueOnce(MOCK_LIST);

    renderPage(newClient());

    await waitFor(() => expect(screen.getByTestId('overview-dashboard')).toBeTruthy());
    expect(screen.getByTestId('dash-tenants').textContent).toBe('3');
    expect(screen.getByTestId('dash-list-len').textContent).toBe('1');
  });

  it('is read-only — no create/delete controls', async () => {
    mockGetMetricsSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetTenantList.mockResolvedValueOnce(MOCK_LIST);

    renderPage(newClient());

    await waitFor(() => screen.getByTestId('overview-dashboard'));
    expect(screen.queryByRole('button', { name: /crear|eliminar|delete/i })).toBeNull();
  });
});

// ─── Error ──────────────────────────────────────────────────────────────────

describe('DashboardPage — error state', () => {
  it('renders an error card when the metrics query fails', async () => {
    mockGetMetricsSummary.mockRejectedValueOnce({ status: 500, message: 'Error interno' });
    mockGetTenantList.mockResolvedValueOnce(MOCK_LIST);

    renderPage(newClient());

    await waitFor(() => expect(screen.getByTestId('overview-error')).toBeTruthy());
    expect(screen.queryByTestId('overview-dashboard')).toBeNull();
  });

  it('renders an error card when the tenant query fails', async () => {
    mockGetMetricsSummary.mockResolvedValueOnce(MOCK_SUMMARY);
    mockGetTenantList.mockRejectedValueOnce({ status: 503, message: 'No disponible' });

    renderPage(newClient());

    await waitFor(() => expect(screen.getByTestId('overview-error')).toBeTruthy());
    expect(screen.getByTestId('overview-error').textContent).toBeTruthy();
  });
});
