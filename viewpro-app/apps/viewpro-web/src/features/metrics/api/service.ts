// Design B (D7): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import type { MetricsSummary } from './types';

/**
 * Fetch the operator metrics summary from viewpro-api.
 *
 * Endpoint: GET /operators/metrics/summary
 * Auth: viewpro_platform_access_token cookie (credentials:include set by apiRequest).
 * On 401 → session-context redirects to sign-in (D6).
 */
export async function getMetricsSummary(): Promise<MetricsSummary> {
  return apiRequest<MetricsSummary>('/operators/metrics/summary');
}
