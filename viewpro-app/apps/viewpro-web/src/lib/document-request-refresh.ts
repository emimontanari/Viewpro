export const DOCUMENT_REQUESTS_REFETCH_INTERVAL_MS = 10_000;

export function getDocumentRequestsRefetchInterval() {
  if (typeof document === 'undefined') {
    return false;
  }

  return document.visibilityState === 'visible' ? DOCUMENT_REQUESTS_REFETCH_INTERVAL_MS : false;
}
