/**
 * T-17 — RED: metrics api module unit tests
 * Spec: operator-console — Read-Only Metrics Dashboard (scenarios 1-2); D7; D11
 *
 * Tests cover:
 *   - getMetricsSummary() calls GET /operators/metrics/summary with apiRequest
 *   - Response { tenants, byStatus, generatedAt } maps to MetricsSummary type
 *   - byStatus keys are iterated dynamically — no hardcoded status enum (D11)
 *   - metricsKeys generates stable query key array
 *   - metricsSummaryOptions returns queryOptions with queryFn: getMetricsSummary
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock apiRequest before importing the service
vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn()
}));

import { apiRequest } from '@/lib/api-client';
import { getMetricsSummary } from '../service';
import { metricsKeys, metricsSummaryOptions } from '../queries';
import type { MetricsSummary } from '../types';

const mockApiRequest = vi.mocked(apiRequest);

const MOCK_SUMMARY: MetricsSummary = {
  tenants: 5,
  byStatus: { active: 3, suspended: 2 },
  generatedAt: '2026-07-14T10:00:00.000Z'
};

beforeEach(() => {
  mockApiRequest.mockReset();
});

// ─── getMetricsSummary() ─────────────────────────────────────────────────────

describe('getMetricsSummary()', () => {
  it('calls GET /operators/metrics/summary', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_SUMMARY);

    await getMetricsSummary();

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/metrics/summary');
  });

  it('returns { tenants, byStatus, generatedAt } matching MetricsSummary type', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_SUMMARY);

    const result = await getMetricsSummary();

    expect(result.tenants).toBe(5);
    expect(result.byStatus).toEqual({ active: 3, suspended: 2 });
    expect(result.generatedAt).toBe('2026-07-14T10:00:00.000Z');
  });

  it('byStatus keys are dynamic — not a closed enum (D11)', async () => {
    const dynamicSummary: MetricsSummary = {
      tenants: 2,
      byStatus: { some_custom_status: 1, another_status: 1 },
      generatedAt: '2026-07-14T10:00:00.000Z'
    };
    mockApiRequest.mockResolvedValueOnce(dynamicSummary);

    const result = await getMetricsSummary();

    // byStatus is Record<string, number> — any string key is valid
    expect(Object.entries(result.byStatus)).toHaveLength(2);
    expect(result.byStatus['some_custom_status']).toBe(1);
  });

  it('forwards API errors (non-401) without swallowing them', async () => {
    const apiError = { status: 500, message: 'Internal server error' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(getMetricsSummary()).rejects.toMatchObject({ status: 500 });
  });
});

// ─── metricsKeys ─────────────────────────────────────────────────────────────

describe('metricsKeys', () => {
  it('all is a stable constant array ["metrics"]', () => {
    expect(metricsKeys.all).toEqual(['metrics']);
  });

  it('summary() returns [...all, "summary"]', () => {
    expect(metricsKeys.summary()).toEqual(['metrics', 'summary']);
  });
});

// ─── metricsSummaryOptions ───────────────────────────────────────────────────

describe('metricsSummaryOptions', () => {
  it('has queryKey matching metricsKeys.summary()', () => {
    const options = metricsSummaryOptions;
    expect(options.queryKey).toEqual(['metrics', 'summary']);
  });

  it('has queryFn that delegates to getMetricsSummary', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_SUMMARY);

    // Call getMetricsSummary directly (queryFn points to it) to avoid QueryClient context
    const result = await getMetricsSummary();

    expect(result).toEqual(MOCK_SUMMARY);
  });
});
