/**
 * Overview aggregations — pure, client-side derivation of the dashboard panels
 * from REAL ViewPro query data. No mock/demo data: these helpers only reshape
 * what `MetricsSummary` and the tenant list already return.
 *
 *  - statusDistribution: metrics.byStatus (open map, D11) → pie slices
 *  - planDistribution:   TenantListItem.plan               → bar buckets
 *  - overviewStats:      metrics + list                    → stat-card figures
 */
import type { MetricsSummary } from '@/features/metrics/api/types';
import type { TenantListItem } from '@/features/tenants/api/types';

export type ChartDatum = {
  key: string;
  label: string;
  value: number;
  fill: string;
};

// Canonical status order + Spanish labels. byStatus is an open map (D11), so
// keys are normalized to upper-case; unknown keys are appended after these.
const STATUS_ORDER = ['ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED'] as const;

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Activo',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspendido',
  CANCELLED: 'Baja'
};

const STATUS_FILL: Record<string, string> = {
  ACTIVE: 'var(--chart-1)',
  TRIAL: 'var(--chart-2)',
  SUSPENDED: 'var(--chart-3)',
  CANCELLED: 'var(--chart-4)'
};

function titleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * metrics.byStatus → ordered, non-zero pie slices with Spanish labels.
 * Keys are matched case-insensitively; zero counts are dropped.
 */
export function statusDistribution(byStatus: Record<string, number>): ChartDatum[] {
  const counts = new Map<string, number>();
  for (const [rawKey, rawValue] of Object.entries(byStatus)) {
    const key = rawKey.toUpperCase();
    counts.set(key, (counts.get(key) ?? 0) + (rawValue ?? 0));
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const key of STATUS_ORDER) {
    if (counts.has(key)) {
      ordered.push(key);
      seen.add(key);
    }
  }
  // Append any unknown statuses (open map, D11) in insertion order.
  for (const key of counts.keys()) {
    if (!seen.has(key)) ordered.push(key);
  }

  return ordered
    .map((key, index) => ({
      key,
      label: STATUS_LABELS[key] ?? titleCase(key),
      value: counts.get(key) ?? 0,
      fill: STATUS_FILL[key] ?? `var(--chart-${(index % 5) + 1})`
    }))
    .filter((datum) => datum.value > 0);
}

// Fixed three-tier plan catalog (D10) + the "no plan yet" bucket.
const PLAN_BUCKETS: { key: string; label: string; fill: string; match: TenantListItem['plan'] }[] = [
  { key: 'BASICO', label: 'Básico', fill: 'var(--chart-1)', match: 'BASICO' },
  { key: 'PROFESIONAL', label: 'Profesional', fill: 'var(--chart-2)', match: 'PROFESIONAL' },
  { key: 'EMPRESA', label: 'Empresa', fill: 'var(--chart-3)', match: 'EMPRESA' },
  { key: 'SIN_PLAN', label: 'Sin plan', fill: 'var(--chart-4)', match: null }
];

/**
 * Tenant list → plan coverage buckets. Always emits the full catalog (including
 * zero counts) in a stable order so the bar chart keeps a consistent shape.
 */
export function planDistribution(tenants: TenantListItem[]): ChartDatum[] {
  return PLAN_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    fill: bucket.fill,
    value: tenants.filter((tenant) => tenant.plan === bucket.match).length
  }));
}

export type OverviewStats = {
  total: number;
  active: number;
  trial: number;
  withPlan: number;
};

function statusCount(byStatus: Record<string, number>, status: string): number {
  let total = 0;
  for (const [key, value] of Object.entries(byStatus)) {
    if (key.toUpperCase() === status) total += value ?? 0;
  }
  return total;
}

/**
 * Stat-card figures: authoritative total from metrics; active/trial from the
 * metrics status map; plan coverage counted from the tenant list.
 */
export function overviewStats(
  metrics: MetricsSummary,
  tenants: TenantListItem[]
): OverviewStats {
  return {
    total: metrics.tenants,
    active: statusCount(metrics.byStatus, 'ACTIVE'),
    trial: statusCount(metrics.byStatus, 'TRIAL'),
    withPlan: tenants.filter((tenant) => tenant.plan !== null).length
  };
}
