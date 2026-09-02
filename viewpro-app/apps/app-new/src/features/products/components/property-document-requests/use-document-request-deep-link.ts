import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProductDocumentRequestsResponse } from '../../api/types';

type UseDocumentRequestDeepLinkOptions = {
  highlightDocId: string | null;
  documentRequestsData: ProductDocumentRequestsResponse | undefined;
  isDocumentRequestsSuccess: boolean;
  setDocumentFilter: (filter: string | null) => void;
};

export function useDocumentRequestDeepLink({
  highlightDocId,
  documentRequestsData,
  isDocumentRequestsSuccess,
  setDocumentFilter
}: UseDocumentRequestDeepLinkOptions) {
  const [resolvedOpen, setResolvedOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didResetFilterRef = useRef(false);
  const didOpenResolvedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!highlightDocId || didResetFilterRef.current) {
      return;
    }
    didResetFilterRef.current = true;
    void setDocumentFilter(null);
  }, [highlightDocId, setDocumentFilter]);

  useEffect(() => {
    if (!highlightDocId || !isDocumentRequestsSuccess || !documentRequestsData) {
      return;
    }

    const item = documentRequestsData.items.find((request) => request.id === highlightDocId);
    if (!item) {
      return;
    }

    if ((item.status === 'APPROVED' || item.status === 'REJECTED') && !didOpenResolvedRef.current) {
      didOpenResolvedRef.current = true;
      setResolvedOpen(true);
    }
  }, [highlightDocId, isDocumentRequestsSuccess, documentRequestsData]);

  useEffect(() => {
    if (!highlightDocId || !isDocumentRequestsSuccess || !documentRequestsData) {
      return;
    }

    const item = documentRequestsData.items.find((request) => request.id === highlightDocId);
    if (!item) {
      return;
    }

    const isResolved = item.status === 'APPROVED' || item.status === 'REJECTED';
    if (isResolved && !resolvedOpen) {
      return;
    }

    const selector = `[data-request-id="${CSS.escape(highlightDocId)}"]`;
    const element = containerRef.current?.querySelector(selector);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightedId(highlightDocId);
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedId(null);
      highlightTimerRef.current = null;
    }, 2000);
  }, [highlightDocId, isDocumentRequestsSuccess, documentRequestsData, resolvedOpen]);

  const onResolvedOpenChange = useCallback((open: boolean) => {
    setResolvedOpen(open);
  }, []);

  return { containerRef, highlightedId, resolvedOpen, onResolvedOpenChange };
}
