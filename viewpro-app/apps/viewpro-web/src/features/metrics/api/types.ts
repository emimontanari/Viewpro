/**
 * MetricsSummary — matches viewpro-api MetricsSummary exactly.
 *
 * Source: apps/viewpro-api/src/platform-data/metrics.service.ts
 *   export interface MetricsSummary {
 *     tenants: number;
 *     byStatus: Record<string, number>;
 *     generatedAt: string;
 *   }
 *
 * byStatus keys are dynamic (D11 — open map, not a closed enum).
 */
export type MetricsSummary = {
  tenants: number;
  byStatus: Record<string, number>;
  generatedAt: string;
};
