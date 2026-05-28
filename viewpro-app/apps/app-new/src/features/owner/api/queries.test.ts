import { getDocumentRequestsRefetchInterval } from '@/lib/document-request-refresh';
import { describe, expect, it } from 'vitest';
import { ownerDocumentRequestsOptions } from './queries';

describe('owner document request query options', () => {
  it('enables selective near-realtime refresh for owner documents', () => {
    const options = ownerDocumentRequestsOptions('engagement-1', { pageSize: 20 });

    expect(options.refetchInterval).toBe(getDocumentRequestsRefetchInterval);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe('always');
  });
});
