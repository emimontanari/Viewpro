import { queryOptions } from '@tanstack/react-query';
import { getAuditFeed } from './service';

export const auditKeys = {
  all: ['audit'] as const,
  list: (offset: number, limit: number) => [...auditKeys.all, 'list', offset, limit] as const
};

export const auditFeedOptions = (offset: number, limit: number) =>
  queryOptions({
    queryKey: auditKeys.list(offset, limit),
    queryFn: () => getAuditFeed(offset, limit)
  });
