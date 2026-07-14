/**
 * T-19 — RED: dashboard page component tests
 * Spec: operator-console — Read-Only Metrics Dashboard (all 3 scenarios); D11
 *
 * Tests cover:
 *   - Loading state → skeleton cards rendered (not an error)
 *   - Successful query → MetricsSummaryCards rendered with data (spec scenario 1)
 *   - Query error (non-401) → inline error state rendered (spec scenario 3)
 *   - Page is read-only — no mutation controls rendered (spec invariant)
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { MetricsSummary } from '@/features/metrics/api/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the entire metrics api module
vi.mock('@/features/metrics/api/queries', () => ({
  metricsSummaryOptions: {
    queryKey: ['metrics', 'summary'],
    queryFn: vi.fn()
  }
}));

vi.mock('@/features/metrics/api/service', () => ({
  getMetricsSummary: vi.fn()
}));

// Mock MetricsSummaryCards so we isolate the page logic
vi.mock('@/features/metrics/components/metrics-summary-cards', () => ({
  MetricsSummaryCards: ({ data }: { data: MetricsSummary }) => (
    <div data-testid='metrics-summary-cards'>
      <span data-testid='mock-tenants'>{data.tenants}</span>
    </div>
  )
}));

// next/navigation mock
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams()
}));

import { getMetricsSummary } from '@/features/metrics/api/service';
import { metricsSummaryOptions } from '@/features/metrics/api/queries';
import DashboardPage from '../page';

const mockGetMetricsSummary = vi.mocked(getMetricsSummary);
const mockOptions = vi.mocked(metricsSummaryOptions) as unknown as { queryKey: string[]; queryFn: ReturnType<typeof vi.fn> };

const MOCK_SUMMARY: MetricsSummary = {
  tenants: 5,
  byStatus: { active: 3, suspended: 2 },
  generatedAt: '2026-07-14T10:00:00.000Z'
};

function renderPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Keep the mock queryFn in sync with the mock options
  mockOptions.queryFn = mockGetMetricsSummary;
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('DashboardPage — loading state', () => {
  it('renders skeleton while query is loading (not an error)', () => {
    mockGetMetricsSummary.mockReturnValue(new Promise(() => {}));

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(qc);

    expect(screen.getByTestId('metrics-loading-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('metrics-error')).toBeNull();
  });
});

// ─── Success state ────────────────────────────────────────────────────────────

describe('DashboardPage — success state', () => {
  it('renders MetricsSummaryCards with data on success (spec scenario 1)', async () => {
    mockGetMetricsSummary.mockResolvedValueOnce(MOCK_SUMMARY);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(qc);

    await waitFor(() => {
      expect(screen.getByTestId('metrics-summary-cards')).toBeTruthy();
    });
    expect(screen.getByTestId('mock-tenants').textContent).toBe('5');
  });

  it('page is read-only — no mutation controls (create/edit/delete buttons) rendered', async () => {
    mockGetMetricsSummary.mockResolvedValueOnce(MOCK_SUMMARY);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(qc);

    await waitFor(() => screen.getByTestId('metrics-summary-cards'));

    // No submit/create/delete buttons on a read-only dashboard
    expect(screen.queryByRole('button', { name: /crear|crear|delete|eliminar/i })).toBeNull();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('DashboardPage — error state', () => {
  it('renders error card on non-401 API failure (spec scenario 3)', async () => {
    const apiError = { status: 500, message: 'Error interno del servidor' };
    mockGetMetricsSummary.mockRejectedValueOnce(apiError);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(qc);

    await waitFor(() => {
      expect(screen.getByTestId('metrics-error')).toBeTruthy();
    });
    expect(screen.queryByTestId('metrics-summary-cards')).toBeNull();
  });

  it('error state does not crash — renders a human-readable message', async () => {
    const apiError = { status: 503, message: 'Service unavailable' };
    mockGetMetricsSummary.mockRejectedValueOnce(apiError);

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    renderPage(qc);

    await waitFor(() => {
      expect(screen.getByTestId('metrics-error')).toBeTruthy();
    });
    // Should show a message, not throw
    expect(screen.getByTestId('metrics-error').textContent).toBeTruthy();
  });
});
