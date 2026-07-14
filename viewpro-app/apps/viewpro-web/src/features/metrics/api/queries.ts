import { queryOptions } from '@tanstack/react-query';
import { getMetricsSummary } from './service';

export const metricsKeys = {
  all: ['metrics'] as const,
  summary: () => [...metricsKeys.all, 'summary'] as const
};

export const metricsSummaryOptions = queryOptions({
  queryKey: metricsKeys.summary(),
  queryFn: getMetricsSummary
});
