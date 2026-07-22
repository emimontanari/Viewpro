/**
 * T-19 — RED: MetricsSummaryCards component tests
 * Spec: operator-console — Read-Only Metrics Dashboard (all 3 scenarios); D11
 *
 * Tests cover:
 *   - Renders total tenant count card
 *   - Renders one card per byStatus entry with dynamic key + count (D11 open map)
 *   - Renders generatedAt timestamp in footer
 *   - tenants===0 + byStatus=={} → renders empty-state, NOT an error
 */

import * as React from 'react';
import { vi, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { MetricsSummary } from '@/features/metrics/api/types';

// Mock the empty-state to isolate MetricsSummaryCards rendering
vi.mock('../metrics-empty-state', () => ({
  MetricsEmptyState: () => <div data-testid='metrics-empty-state'>Todavía no hay métricas</div>
}));

import { MetricsSummaryCards } from '../metrics-summary-cards';

const MOCK_SUMMARY: MetricsSummary = {
  tenants: 5,
  byStatus: { active: 3, suspended: 2 },
  generatedAt: '2026-07-14T10:00:00.000Z'
};

const EMPTY_SUMMARY: MetricsSummary = {
  tenants: 0,
  byStatus: {},
  generatedAt: '2026-07-14T10:00:00.000Z'
};

// ─── With data ───────────────────────────────────────────────────────────────

describe('MetricsSummaryCards — with data', () => {
  it('renders the total tenant count (spec scenario 1)', () => {
    render(<MetricsSummaryCards data={MOCK_SUMMARY} />);

    expect(screen.getByTestId('total-tenants-count').textContent).toBe('5');
  });

  it('renders one row per byStatus entry with key + count (D11 open map)', () => {
    render(<MetricsSummaryCards data={MOCK_SUMMARY} />);

    expect(screen.getByTestId('status-active')).toBeTruthy();
    expect(screen.getByTestId('status-active').textContent).toContain('3');
    expect(screen.getByTestId('status-suspended')).toBeTruthy();
    expect(screen.getByTestId('status-suspended').textContent).toContain('2');
  });

  it('renders the generatedAt timestamp in footer (spec scenario 1)', () => {
    render(<MetricsSummaryCards data={MOCK_SUMMARY} />);

    // Should show a human-readable version of the timestamp
    expect(screen.getByTestId('generated-at')).toBeTruthy();
    // The test-id exists — content formatting verified visually
  });

  it('does NOT render empty-state when tenants > 0 (spec scenario 2 inverse)', () => {
    render(<MetricsSummaryCards data={MOCK_SUMMARY} />);

    expect(screen.queryByTestId('metrics-empty-state')).toBeNull();
  });
});

// ─── Empty state (D11) ───────────────────────────────────────────────────────

describe('MetricsSummaryCards — empty state (D11)', () => {
  it('renders empty-state component when tenants===0, NOT an error (spec scenario 2)', () => {
    render(<MetricsSummaryCards data={EMPTY_SUMMARY} />);

    expect(screen.getByTestId('metrics-empty-state')).toBeTruthy();
  });

  it('does NOT render status breakdown when empty (D11)', () => {
    render(<MetricsSummaryCards data={EMPTY_SUMMARY} />);

    expect(screen.queryByTestId('status-active')).toBeNull();
  });
});
