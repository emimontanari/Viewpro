import { queryOptions } from '@tanstack/react-query';
import { getOperatorList } from './service';

export const operatorsKeys = {
  all: ['operators'] as const,
  list: () => [...operatorsKeys.all, 'list'] as const
};

export const operatorsListOptions = () =>
  queryOptions({
    queryKey: operatorsKeys.list(),
    queryFn: () => getOperatorList(),
    // Live refresh (mirrors tenantsListOptions): the roster auto-updates
    // when a role/status change lands via another operator's session.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always'
  });
