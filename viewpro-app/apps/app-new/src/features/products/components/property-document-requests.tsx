'use client';

import { messageFor } from '@/lib/bff-client';
import { Icons, type Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconFilePlus } from '@tabler/icons-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { productDocumentRequestsOptions, productKeys } from '../api/queries';
import {
  approveProductDocumentRequest,
  createProductDocumentReadUrl,
  createProductDocumentRequest,
  rejectProductDocumentRequest
} from '../api/service';
import type {
  CreateProductDocumentRequestPayload,
  ProductDocumentRequest,
  ProductDocumentVersion,
  PropertyLinkedOwner
} from '../api/types';
import { CreateDocumentRequestDialog } from './create-document-request-dialog';
import {
  formatCompactDateTime,
  getCompactDocumentDescription,
  getDocumentDisplayName,
  getDocumentFilter,
  getFilterCounts,
  getPendingDocumentSummary,
  getRequestChronologyTimestamp,
  getVersionMetadata,
  getVisibleGroups,
  groupDocumentRequests,
  isImageMimeType,
  isEligibleDocumentOwner,
  type DocumentFilter
} from './property-document-requests/model';
import {
  DocumentRequestList,
  DocumentRequestSection,
  DocumentStatusBadge,
  RejectionReason
} from './property-document-requests/request-list';
import { RejectDocumentRequestDialog } from './reject-document-request-dialog';
import {
  DocumentRequestFilters,
  DocumentRequestHint,
  DocumentRequestStates
} from './property-document-requests/states-and-filters';

type PropertyDocumentRequestsProps = {
  canRequestDocuments?: boolean;
  canReviewDocuments?: boolean;
  isArchived: boolean;
  owners: PropertyLinkedOwner[];
  productId: string;
  tenantId: string;
};

const EMPTY_DOCUMENT_REQUESTS: ProductDocumentRequest[] = [];

export function PropertyDocumentRequests({
  canRequestDocuments = true,
  canReviewDocuments = true,
  isArchived,
  owners,
  productId,
  tenantId
}: PropertyDocumentRequestsProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<ProductDocumentRequest | null>(null);
  const [documentFilter, setDocumentFilter] = useQueryState(
    'documentos',
    parseAsString
      .withOptions({ history: 'replace', scroll: false, shallow: true })
      .withDefault('all')
  );
  // D3: read the deep-link doc param (read-only sibling nuqs param).
  const [highlightDocId] = useQueryState('doc', parseAsString);
  // D4: controlled open state for the resolved Collapsible.
  const [resolvedOpen, setResolvedOpen] = useState(false);
  // D6: transient highlight state + container ref for querySelector scope.
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // D5: one-shot filter reset guard — fires exactly once per mount with a non-null doc.
  const didResetFilterRef = useRef(false);
  // D4: one-shot resolved-open guard — prevents re-fighting a user collapse.
  const didOpenResolvedRef = useRef(false);
  const activeFilter = getDocumentFilter(documentFilter);
  const documentRequestsQueryKey = productKeys.documentRequests(productId, tenantId);
  const eligibleOwners = useMemo(() => owners.filter(isEligibleDocumentOwner), [owners]);
  const invitedOwnerCount = useMemo(
    () => eligibleOwners.filter((owner) => owner.accessStatus === 'INVITED').length,
    [eligibleOwners]
  );
  const documentRequestsQuery = useQuery(productDocumentRequestsOptions(productId, tenantId));
  const documentRequests = documentRequestsQuery.data?.items ?? EMPTY_DOCUMENT_REQUESTS;
  const groupedRequests = useMemo(
    () => groupDocumentRequests(documentRequests, getRequestChronologyTimestamp),
    [documentRequests]
  );
  const filterCounts = useMemo(() => getFilterCounts(groupedRequests), [groupedRequests]);
  const visibleGroups = getVisibleGroups(groupedRequests, activeFilter);
  const createDocumentRequestMutation = useMutation({
    mutationFn: (payload: CreateProductDocumentRequestPayload) =>
      createProductDocumentRequest(productId, payload),
    onSuccess: async () => {
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Solicitud de documento creada');
    },
    onError: (error) => {
      toast.error(messageFor(error, 'No se pudo solicitar el documento'));
    }
  });
  const readDocumentMutation = useMutation({
    mutationFn: (versionId: string) => createProductDocumentReadUrl(versionId),
    onSuccess: ({ readUrl }) => {
      window.open(readUrl.url, '_blank', 'noopener,noreferrer');
    },
    onError: (error) => {
      toast.error(messageFor(error, 'No se pudo abrir el documento'));
    }
  });
  const approveDocumentMutation = useMutation({
    mutationFn: (requestId: string) => approveProductDocumentRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Documento aprobado');
    },
    onError: (error) => {
      toast.error(messageFor(error, 'No se pudo aprobar el documento'));
    }
  });
  const rejectDocumentMutation = useMutation({
    mutationFn: ({ reason, requestId }: { reason: string; requestId: string }) =>
      rejectProductDocumentRequest(requestId, { reason }),
    onSuccess: async () => {
      setRequestToReject(null);
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Documento rechazado');
    },
    onError: (error) => {
      toast.error(messageFor(error, 'No se pudo rechazar el documento'));
    }
  });

  // Cleanup: clear the highlight timer on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // D5: one-shot filter reset. Fires once when doc is non-null on first render with a
  // truthy highlightDocId. The ref guard prevents re-firing on subsequent renders.
  useEffect(() => {
    if (!highlightDocId || didResetFilterRef.current) {
      return;
    }
    didResetFilterRef.current = true;
    void setDocumentFilter(null);
  }, [highlightDocId, setDocumentFilter]);

  // D4 + D6 (R1 split-effect path): Two effects to avoid the single-tick race where
  // setResolvedOpen(true) and scrollIntoView fire in the same tick — Radix needs a
  // re-render between the open state change and scrollIntoView measuring layout.
  //
  // Effect A: data resolves → find target → open resolved group if needed.
  useEffect(() => {
    if (!highlightDocId || !documentRequestsQuery.isSuccess) {
      return;
    }

    const item = documentRequestsQuery.data.items.find((i) => i.id === highlightDocId);
    // If absent (deleted, CANCELLED-not-rendered, wrong id) → no-op, no throw (R5).
    if (!item) {
      return;
    }

    // Open the resolved Collapsible if the target is APPROVED or REJECTED (D4).
    if ((item.status === 'APPROVED' || item.status === 'REJECTED') && !didOpenResolvedRef.current) {
      didOpenResolvedRef.current = true;
      setResolvedOpen(true);
    }
  }, [highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data]);

  // Effect B: after resolvedOpen (or data resolved for non-resolved items) → scroll + highlight.
  // Keyed on resolvedOpen so it runs after Radix has painted the open content.
  useEffect(() => {
    if (!highlightDocId || !documentRequestsQuery.isSuccess) {
      return;
    }

    const item = documentRequestsQuery.data.items.find((i) => i.id === highlightDocId);
    if (!item) {
      return;
    }

    // For resolved items, only scroll once the Collapsible is open (resolvedOpen = true).
    const isResolved = item.status === 'APPROVED' || item.status === 'REJECTED';
    if (isResolved && !resolvedOpen) {
      return;
    }

    // Scroll to the target element (D6). Only arm the highlight when the element is
    // actually rendered — if the target is filtered out / not present, do not scroll
    // or arm the transient highlight (FR-F9: no highlight fire when not found).
    const selector = `[data-request-id="${CSS.escape(highlightDocId)}"]`;
    const element = containerRef.current?.querySelector(selector);
    if (!element) {
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Transient highlight (D6).
    setHighlightedId(highlightDocId);
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedId(null);
      highlightTimerRef.current = null;
    }, 2000);
  }, [highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data, resolvedOpen]);

  function handleOpenDialog() {
    if (
      isArchived ||
      !canRequestDocuments ||
      eligibleOwners.length === 0 ||
      createDocumentRequestMutation.isPending
    ) {
      return;
    }

    setDialogOpen(true);
  }

  function handleSubmit(payload: CreateProductDocumentRequestPayload) {
    if (isArchived || !canRequestDocuments || createDocumentRequestMutation.isPending) {
      return;
    }

    createDocumentRequestMutation.mutate(payload);
  }

  function handleRejectSubmit(reason: string) {
    if (!requestToReject || rejectDocumentMutation.isPending) {
      return;
    }

    rejectDocumentMutation.mutate({ requestId: requestToReject.id, reason });
  }

  function handleFilterChange(nextFilter: DocumentFilter) {
    void setDocumentFilter(nextFilter === 'all' ? null : nextFilter);
  }

  return (
    <section className='space-y-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h3 className='text-base font-semibold'>Documentos</h3>
          <p className='text-sm text-muted-foreground'>
            Solicitudes documentales asociadas a esta propiedad.
          </p>
        </div>
        {canRequestDocuments ? (
          <Button
            type='button'
            variant='outline'
            className='border-border/70 bg-transparent hover:bg-muted/40 dark:border-border dark:bg-transparent'
            disabled={
              isArchived || eligibleOwners.length === 0 || createDocumentRequestMutation.isPending
            }
            onClick={handleOpenDialog}
          >
            <IconFilePlus className='size-4' />
            Solicitar documento
          </Button>
        ) : null}
      </div>

      <DocumentRequestHint
        canRequestDocuments={canRequestDocuments}
        isArchived={isArchived}
        eligibleOwnerCount={eligibleOwners.length}
        invitedOwnerCount={invitedOwnerCount}
        linkedOwnerCount={owners.length}
      />

      <div data-testid='document-request-panel-body' className='space-y-4'>
        <DocumentRequestStates
          isEmpty={documentRequests.length === 0}
          isError={documentRequestsQuery.isError}
          isLoading={documentRequestsQuery.isLoading}
        />
        {!documentRequestsQuery.isLoading &&
        !documentRequestsQuery.isError &&
        documentRequests.length > 0 ? (
          <div className='space-y-4'>
            <DocumentRequestFilters
              activeFilter={activeFilter}
              counts={filterCounts}
              onFilterChange={handleFilterChange}
            />
            <div
              ref={containerRef}
              data-testid='document-request-results'
              className='min-h-[28rem] space-y-4 [overflow-anchor:none] sm:min-h-[32rem]'
            >
              {visibleGroups.map((group) => (
                <DocumentRequestSection
                  key={group.key}
                  group={group}
                  resolvedOpen={resolvedOpen}
                  onResolvedOpenChange={setResolvedOpen}
                >
                  <DocumentRequestList
                    emptyCopy={group.emptyCopy}
                    highlightedId={highlightedId}
                    items={group.items}
                    renderItem={(request) => (
                      <DocumentRequestItem
                        canReviewDocuments={canReviewDocuments}
                        request={request}
                        isApproving={approveDocumentMutation.isPending}
                        isReading={readDocumentMutation.isPending}
                        isRejecting={rejectDocumentMutation.isPending}
                        onApprove={(requestId) => approveDocumentMutation.mutate(requestId)}
                        onRead={(versionId) => readDocumentMutation.mutate(versionId)}
                        onReject={setRequestToReject}
                      />
                    )}
                  />
                </DocumentRequestSection>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <CreateDocumentRequestDialog
        open={dialogOpen}
        owners={eligibleOwners}
        isSubmitting={createDocumentRequestMutation.isPending}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
      <RejectDocumentRequestDialog
        open={requestToReject !== null}
        requestTitle={requestToReject?.title}
        isSubmitting={rejectDocumentMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !rejectDocumentMutation.isPending) {
            setRequestToReject(null);
          }
        }}
        onSubmit={handleRejectSubmit}
      />
    </section>
  );
}

function DocumentRequestItem({
  canReviewDocuments,
  isApproving,
  isReading,
  isRejecting,
  onApprove,
  onRead,
  onReject,
  request
}: {
  canReviewDocuments: boolean;
  isApproving: boolean;
  isReading: boolean;
  isRejecting: boolean;
  onApprove: (requestId: string) => void;
  onRead: (versionId: string) => void;
  onReject: (request: ProductDocumentRequest) => void;
  request: ProductDocumentRequest;
}) {
  const canReview =
    canReviewDocuments && request.status === 'SUBMITTED' && request.currentVersion !== null;
  const canOpenDocument = request.currentVersion !== null;
  const isPassivePending = request.status === 'PENDING';
  const compactDescription = getCompactDocumentDescription(request);
  const reviewActionsDisabled = isApproving || isReading || isRejecting;

  return (
    <Card
      className={cn(
        'gap-0 overflow-hidden py-0 shadow-xs',
        isPassivePending ? 'bg-background/70' : null
      )}
    >
      <CardHeader className={cn('bg-transparent px-5 pb-2', isPassivePending ? 'pt-4' : 'pt-5')}>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h5 className='break-words text-sm font-semibold'>{request.title}</h5>
              <DocumentStatusBadge status={request.status} />
            </div>
          </div>
          <p className='shrink-0 text-xs text-foreground/70'>
            Actualizado {formatCompactDateTime(getRequestChronologyTimestamp(request))}
          </p>
        </div>
      </CardHeader>

      <CardContent
        className={cn('px-5 pt-2', isPassivePending ? 'space-y-3 pb-4' : 'space-y-5 pb-5')}
      >
        {isPassivePending ? (
          <p
            data-testid='document-passive-summary'
            className='truncate text-sm text-foreground/70'
            title={getPendingDocumentSummary(compactDescription)}
          >
            {getPendingDocumentSummary(compactDescription)}
          </p>
        ) : compactDescription ? (
          <p className='truncate text-sm text-foreground/70' title={compactDescription}>
            {compactDescription}
          </p>
        ) : null}

        {request.rejectionReason ? <RejectionReason reason={request.rejectionReason} /> : null}

        {request.currentVersion ? (
          <DocumentVersionSummary
            request={request}
            version={request.currentVersion}
            isReading={isReading}
            onRead={onRead}
          />
        ) : null}

        {canOpenDocument || canReview ? (
          <div
            data-testid={canReview ? 'document-review-action-row' : undefined}
            className='flex flex-wrap items-center gap-2 border-t border-border/40 pt-3'
          >
            {canOpenDocument ? (
              <Button
                type='button'
                variant='ghost'
                className='min-h-11 px-2 text-foreground/70 hover:bg-muted/40 hover:text-foreground'
                disabled={isReading}
                onClick={() => onRead(request.currentVersion!.id)}
              >
                <Icons.externalLink className='size-4' />
                Abrir documento
              </Button>
            ) : null}
            {canReview ? (
              <>
                <div className='hidden flex-1 sm:block' />
                <div
                  data-testid='document-review-decision-actions'
                  className='flex flex-1 flex-wrap justify-end gap-2 sm:flex-none'
                >
                  <Button
                    type='button'
                    variant='outline'
                    className='min-h-11 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none'
                    disabled={reviewActionsDisabled}
                    onClick={() => onReject(request)}
                  >
                    <Icons.close className='size-4' />
                    Rechazar
                  </Button>
                  <Button
                    type='button'
                    className='min-h-11 flex-1 border border-emerald-300 bg-emerald-200 text-emerald-950 hover:bg-emerald-300 dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200 sm:flex-none'
                    disabled={reviewActionsDisabled}
                    onClick={() => onApprove(request.id)}
                  >
                    <Icons.check className='size-4' />
                    Aprobar
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DocumentVersionSummary({
  isReading,
  onRead,
  request,
  version
}: {
  isReading: boolean;
  onRead: (versionId: string) => void;
  request: ProductDocumentRequest;
  version: ProductDocumentVersion;
}) {
  const displayName = getDocumentDisplayName(request, version);
  const metadata = getVersionMetadata(request, version);

  return (
    <button
      type='button'
      data-testid='document-version-summary'
      aria-label={`Abrir documento ${displayName}`}
      className='flex min-h-11 w-fit max-w-full min-w-0 items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-left text-sm outline-none transition-colors hover:border-border hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50'
      disabled={isReading}
      onClick={() => onRead(version.id)}
    >
      <DocumentVersionPreviewMedia requestTitle={request.title} version={version} />
      <span className='min-w-0 truncate'>
        <span className='font-medium text-foreground'>{displayName}</span>
        <span className='ml-2 text-xs text-foreground/70'>{metadata}</span>
      </span>
    </button>
  );
}

function DocumentVersionPreviewMedia({
  requestTitle,
  version
}: {
  requestTitle: string;
  version: ProductDocumentVersion;
}) {
  const isImage = isImageMimeType(version.mimeType);
  const previewQuery = useQuery({
    enabled: isImage,
    queryKey: [...productKeys.all, 'document-version-preview', version.id],
    queryFn: () => createProductDocumentReadUrl(version.id),
    retry: false,
    staleTime: 60_000
  });

  if (isImage && previewQuery.data?.readUrl.url) {
    return (
      <span className='size-8 shrink-0 overflow-hidden rounded-md bg-muted'>
        {/* oxlint-disable-next-line next/no-img-element -- document thumbnails use signed, short-lived URLs from the authenticated storage flow. */}
        <img
          src={previewQuery.data.readUrl.url}
          alt={`Vista previa de ${requestTitle}`}
          className='h-full w-full object-cover'
          loading='lazy'
        />
      </span>
    );
  }

  const FileIcon = getDocumentFileIcon(version.mimeType);

  return (
    <span className='flex size-8 shrink-0 items-center justify-center rounded-md bg-background/70 text-foreground/70'>
      <FileIcon aria-hidden='true' className='size-4' />
    </span>
  );
}

function getDocumentFileIcon(mimeType: string): Icon {
  if (mimeType === 'application/pdf') {
    // TODO: replace this fallback with a real first-page PDF thumbnail when preview generation exists.
    return Icons.fileTypePdf;
  }

  if (isImageMimeType(mimeType)) {
    return Icons.media;
  }

  return Icons.page;
}
