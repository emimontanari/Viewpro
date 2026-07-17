/**
 * Overview aggregations — client-side derivation of the dashboard panels from
 * REAL ViewPro query data (MetricsSummary + TenantListItem[]). No mock/demo
 * data ever ships; these pure helpers only reshape what the queries return.
 */
import { describe, it, expect } from 'vitest';

import type { MetricsSummary } from '@/features/metrics/api/types';
import type { TenantListItem } from '@/features/tenants/api/types';

import {
  statusDistribution,
  planDistribution,
  overviewStats
} from '../aggregations';

function tenant(overrides: Partial<TenantListItem>): TenantListItem {
  return {
    id: overrides.id ?? 'id',
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

// ─── statusDistribution ─────────────────────────────────────────────────────

describe('statusDistribution', () => {
  it('maps byStatus counts to Spanish labels in canonical order', () => {
    const result = statusDistribution({ ACTIVE: 3, TRIAL: 1, SUSPENDED: 2 });

    expect(result.map((d) => d.label)).toEqual(['Activo', 'Trial', 'Suspendido']);
    expect(result.map((d) => d.value)).toEqual([3, 1, 2]);
  });

  it('normalizes byStatus keys case-insensitively (open map, D11)', () => {
    const result = statusDistribution({ active: 3, suspended: 2 });

    const active = result.find((d) => d.key === 'ACTIVE');
    const suspended = result.find((d) => d.key === 'SUSPENDED');
    expect(active?.value).toBe(3);
    expect(active?.label).toBe('Activo');
    expect(suspended?.value).toBe(2);
    expect(suspended?.label).toBe('Suspendido');
  });

  it('drops zero-count statuses', () => {
    const result = statusDistribution({ ACTIVE: 2, CANCELLED: 0 });

    expect(result.map((d) => d.key)).toEqual(['ACTIVE']);
  });

  it('assigns a chart color token to every slice', () => {
    const result = statusDistribution({ ACTIVE: 1, TRIAL: 1 });

    expect(result.every((d) => d.fill.startsWith('var(--chart-'))).toBe(true);
  });

  it('returns an empty array for an empty byStatus map', () => {
    expect(statusDistribution({})).toEqual([]);
  });
});

// ─── planDistribution ───────────────────────────────────────────────────────

describe('planDistribution', () => {
  it('counts tenants per plan with Spanish labels', () => {
    const tenants = [
      tenant({ id: '1', plan: 'BASICO' }),
      tenant({ id: '2', plan: 'PROFESIONAL' }),
      tenant({ id: '3', plan: 'PROFESIONAL' }),
      tenant({ id: '4', plan: 'EMPRESA' })
    ];

    const result = planDistribution(tenants);
    const byLabel = Object.fromEntries(result.map((d) => [d.label, d.value]));

    expect(byLabel['Básico']).toBe(1);
    expect(byLabel['Profesional']).toBe(2);
    expect(byLabel['Empresa']).toBe(1);
  });

  it('buckets tenants without a plan into "Sin plan"', () => {
    const tenants = [
      tenant({ id: '1', plan: null }),
      tenant({ id: '2', plan: null }),
      tenant({ id: '3', plan: 'BASICO' })
    ];

    const result = planDistribution(tenants);
    const sinPlan = result.find((d) => d.label === 'Sin plan');
    expect(sinPlan?.value).toBe(2);
  });

  it('always emits the full four-bucket catalog (including zeros) in order', () => {
    const result = planDistribution([tenant({ plan: 'BASICO' })]);

    expect(result.map((d) => d.label)).toEqual([
      'Básico',
      'Profesional',
      'Empresa',
      'Sin plan'
    ]);
  });

  it('returns all-zero buckets for an empty tenant list', () => {
    const result = planDistribution([]);
    expect(result.every((d) => d.value === 0)).toBe(true);
  });
});

// ─── overviewStats ──────────────────────────────────────────────────────────

describe('overviewStats', () => {
  const metrics: MetricsSummary = {
    tenants: 5,
    byStatus: { ACTIVE: 3, TRIAL: 1, SUSPENDED: 1 },
    generatedAt: '2026-07-15T10:00:00.000Z'
  };

  it('reports total from metrics, and active/trial/withPlan from the data', () => {
    const tenants = [
      tenant({ id: '1', status: 'ACTIVE', plan: 'BASICO' }),
      tenant({ id: '2', status: 'ACTIVE', plan: 'EMPRESA' }),
      tenant({ id: '3', status: 'TRIAL', plan: null })
    ];

    const stats = overviewStats(metrics, tenants);

    expect(stats.total).toBe(5);
    expect(stats.active).toBe(3); // from byStatus
    expect(stats.trial).toBe(1); // from byStatus
    expect(stats.withPlan).toBe(2); // tenants with a non-null plan
  });

  it('handles zero tenants gracefully', () => {
    const empty: MetricsSummary = { tenants: 0, byStatus: {}, generatedAt: 'x' };
    const stats = overviewStats(empty, []);

    expect(stats).toEqual({ total: 0, active: 0, trial: 0, withPlan: 0 });
  });
});
