/**
 * OverviewDashboard — presentational charts dashboard fed by REAL ViewPro data.
 *
 * The component is pure (props in, panels out): the page owns fetching. These
 * tests feed fixture MetricsSummary + TenantListItem[] and assert the panels
 * reflect the real aggregated counts — never mock/demo data.
 *
 * recharts renders inside a ResponsiveContainer that needs ResizeObserver;
 * jsdom lacks it, so we polyfill it here. The panels also expose an accessible
 * legend list carrying the semantic values, which is what we assert on.
 */
import * as React from 'react';
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import type { MetricsSummary } from '@/features/metrics/api/types';
import type { TenantListItem } from '@/features/tenants/api/types';

import { OverviewDashboard } from '../overview-dashboard';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

function tenant(overrides: Partial<TenantListItem>): TenantListItem {
  return {
    id: overrides.id ?? Math.random().toString(),
    name: overrides.name ?? 'Inmobiliaria',
    slug: overrides.slug ?? 'slug',
    status: overrides.status ?? 'ACTIVE',
    limits: overrides.limits ?? {
      maxUsers: null,
      maxActivePropertyEngagements: null,
      maxDocumentsStorageMb: null
    },
    trialEndsAt: overrides.trialEndsAt ?? null,
    plan: overrides.plan ?? null
  };
}

const METRICS: MetricsSummary = {
  tenants: 4,
  byStatus: { ACTIVE: 2, TRIAL: 1, SUSPENDED: 1 },
  generatedAt: '2026-07-15T10:00:00.000Z'
};

const TENANTS: TenantListItem[] = [
  tenant({ id: '1', status: 'ACTIVE', plan: 'BASICO' }),
  tenant({ id: '2', status: 'ACTIVE', plan: 'PROFESIONAL' }),
  tenant({ id: '3', status: 'TRIAL', plan: null }),
  tenant({ id: '4', status: 'SUSPENDED', plan: 'PROFESIONAL' })
];

describe('OverviewDashboard — stat cards', () => {
  it('shows the real totals (total from metrics, breakdown from data)', () => {
    render(<OverviewDashboard metrics={METRICS} tenants={TENANTS} />);

    expect(screen.getByTestId('stat-total').textContent).toContain('4');
    expect(screen.getByTestId('stat-active').textContent).toContain('2');
    expect(screen.getByTestId('stat-trial').textContent).toContain('1');
    expect(screen.getByTestId('stat-with-plan').textContent).toContain('3');
  });
});

describe('OverviewDashboard — status distribution panel', () => {
  it('renders a legend slice per status with Spanish label + count', () => {
    render(<OverviewDashboard metrics={METRICS} tenants={TENANTS} />);

    const active = screen.getByTestId('status-legend-ACTIVE');
    expect(active.textContent).toContain('Activo');
    expect(active.textContent).toContain('2');
    expect(screen.getByTestId('status-legend-TRIAL').textContent).toContain('Trial');
    expect(screen.getByTestId('status-legend-SUSPENDED').textContent).toContain('Suspendido');
  });
});

describe('OverviewDashboard — plan distribution panel', () => {
  it('renders the plan buckets with real per-plan counts', () => {
    render(<OverviewDashboard metrics={METRICS} tenants={TENANTS} />);

    expect(screen.getByTestId('plan-legend-BASICO').textContent).toContain('1');
    expect(screen.getByTestId('plan-legend-PROFESIONAL').textContent).toContain('2');
    expect(screen.getByTestId('plan-legend-SIN_PLAN').textContent).toContain('1');
  });
});

describe('OverviewDashboard — zero tenants', () => {
  it('renders a graceful empty state and no chart panels', () => {
    const empty: MetricsSummary = { tenants: 0, byStatus: {}, generatedAt: 'x' };
    render(<OverviewDashboard metrics={empty} tenants={[]} />);

    expect(screen.getByTestId('overview-empty-state')).toBeTruthy();
    expect(screen.queryByTestId('status-legend-ACTIVE')).toBeNull();
    expect(screen.queryByTestId('plan-legend-BASICO')).toBeNull();
  });
});
