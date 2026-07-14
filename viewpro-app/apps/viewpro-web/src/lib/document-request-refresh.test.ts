import { afterEach, describe, expect, it } from 'vitest';
import {
  DOCUMENT_REQUESTS_REFETCH_INTERVAL_MS,
  getDocumentRequestsRefetchInterval
} from './document-request-refresh';

describe('document request refresh cadence', () => {
  afterEach(() => {
    setDocumentVisibility('visible');
  });

  it('polls visible document request pages every 10 seconds', () => {
    setDocumentVisibility('visible');

    expect(getDocumentRequestsRefetchInterval()).toBe(DOCUMENT_REQUESTS_REFETCH_INTERVAL_MS);
  });

  it('pauses polling while the browser tab is hidden', () => {
    setDocumentVisibility('hidden');

    expect(getDocumentRequestsRefetchInterval()).toBe(false);
  });
});

function setDocumentVisibility(visibilityState: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visibilityState
  });
}
