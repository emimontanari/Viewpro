import { getDocumentRequestsRefetchInterval } from '@/lib/document-request-refresh';
import { describe, expect, it } from 'vitest';
import { productDocumentRequestsOptions } from './queries';

describe('product document request query options', () => {
  it('enables selective near-realtime refresh for internal document review', () => {
    const options = productDocumentRequestsOptions('engagement-1', 'tenant-1');

    expect(options.refetchInterval).toBe(getDocumentRequestsRefetchInterval);
    expect(options.refetchIntervalInBackground).toBe(false);
    expect(options.refetchOnWindowFocus).toBe('always');
  });
});
