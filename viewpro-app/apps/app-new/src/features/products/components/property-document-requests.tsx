'use client';

import { messageFor } from '@/lib/bff-client';
import { Icons, type Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  ProductDocumentRequestStatus,
  ProductDocumentVersion,
  PropertyLinkedOwner
} from '../api/types';
import { CreateDocumentRequestDialog } from './create-document-request-dialog';
import {
  DOCUMENT_FILTER_OPTIONS,
  getDocumentFilter,
  getFilterCounts,
  getVisibleGroups,
  groupDocumentRequests,
  isEligibleDocumentOwner,
  type DocumentFilter,
  type DocumentRequestGroup
} from './property-document-requests/model';
import { RejectDocumentRequestDialog } from './reject-document-request-dialog';

type PropertyDocumentRequestsProps = {
  canRequestDocuments?: boolean;
  canReviewDocuments?: boolean;
  isArchived: boolean;
  owners: PropertyLinkedOwner[];
  productId: string;
  tenantId: string;
};

type DocumentStatusConfig = {
  badgeClassName: string;
  icon: Icon;
  label: string;
};

const EMPTY_DOCUMENT_REQUESTS: ProductDocumentRequest[] = [];

const documentStatusConfig: Record<ProductDocumentRequestStatus, DocumentStatusConfig> = {
  APPROVED: {
    badgeClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: Icons.circleCheck,
    label: 'Aprobado'
  },
  CANCELLED: {
    badgeClassName:
      'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
    icon: Icons.circleX,
    label: 'Cancelado'
  },
  PENDING: {
    badgeClassName:
      'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
    icon: Icons.clock,
    label: 'Pendiente'
  },
  REJECTED: {
    badgeClassName:
      'border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive',
    icon: Icons.circleX,
    label: 'Rechazado'
  },
  SUBMITTED: {
    badgeClassName:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
    icon: Icons.upload,
    label: 'Subido'
  }
};

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
        {documentRequestsQuery.isLoading ? <DocumentRequestsLoadingState /> : null}
        {documentRequestsQuery.isError ? <DocumentRequestsErrorState /> : null}
        {!documentRequestsQuery.isLoading &&
        !documentRequestsQuery.isError &&
        documentRequests.length === 0 ? (
          <DocumentRequestsEmptyState />
        ) : null}
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
                  canReviewDocuments={canReviewDocuments}
                  highlightedId={highlightedId}
                  isApproving={approveDocumentMutation.isPending}
                  isReading={readDocumentMutation.isPending}
                  isRejecting={rejectDocumentMutation.isPending}
                  onApprove={(requestId) => approveDocumentMutation.mutate(requestId)}
                  onRead={(versionId) => readDocumentMutation.mutate(versionId)}
                  onReject={setRequestToReject}
                  resolvedOpen={resolvedOpen}
                  onResolvedOpenChange={setResolvedOpen}
                />
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

function DocumentRequestHint({
  canRequestDocuments,
  eligibleOwnerCount,
  invitedOwnerCount,
  isArchived,
  linkedOwnerCount
}: {
  canRequestDocuments: boolean;
  eligibleOwnerCount: number;
  invitedOwnerCount: number;
  isArchived: boolean;
  linkedOwnerCount: number;
}) {
  if (!canRequestDocuments) {
    return null;
  }

  if (isArchived) {
    return (
      <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground'>
        Restaurá la propiedad para solicitar documentación.
      </p>
    );
  }

  if (eligibleOwnerCount === 0) {
    return (
      <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground'>
        {linkedOwnerCount > 0
          ? 'Vinculá un propietario activo o invitado para solicitar documentación.'
          : 'Vinculá un propietario para solicitar documentación.'}
      </p>
    );
  }

  if (invitedOwnerCount > 0) {
    return (
      <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground'>
        Las solicitudes a propietarios invitados quedarán asociadas y podrán verlas cuando activen
        su acceso.
      </p>
    );
  }

  return null;
}

function DocumentRequestsLoadingState() {
  return (
    <div className='space-y-3' aria-label='Cargando documentos'>
      {[0, 1, 2].map((item) => (
        <div key={item} className='space-y-2 rounded-xl border p-3'>
          <div className='h-4 w-40 animate-pulse rounded bg-muted' />
          <div className='h-3 w-full max-w-xl animate-pulse rounded bg-muted' />
          <div className='h-3 w-32 animate-pulse rounded bg-muted' />
        </div>
      ))}
    </div>
  );
}

function DocumentRequestsErrorState() {
  return (
    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
      No se pudieron cargar las solicitudes documentales.
    </div>
  );
}

function DocumentRequestsEmptyState() {
  return (
    <div className='rounded-xl border border-dashed p-4 text-sm text-muted-foreground'>
      Todavía no hay solicitudes de documentos para esta propiedad.
    </div>
  );
}

function DocumentRequestFilters({
  activeFilter,
  counts,
  onFilterChange
}: {
  activeFilter: DocumentFilter;
  counts: Record<DocumentFilter, number>;
  onFilterChange: (filter: DocumentFilter) => void;
}) {
  return (
    <div
      role='tablist'
      className='flex flex-wrap gap-3 border-b border-border/40'
      aria-label='Filtros de solicitudes documentales'
    >
      {DOCUMENT_FILTER_OPTIONS.map((filter) => {
        const count = counts[filter.key];
        const isActive = activeFilter === filter.key;
        const isReviewWarning = filter.key === 'review' && isActive && count > 0;

        return (
          <Button
            key={filter.key}
            type='button'
            role='tab'
            tabIndex={0}
            variant='ghost'
            aria-label={`${filter.label} · ${count}`}
            aria-selected={isActive}
            className={cn(
              'min-h-11 rounded-none border-b-2 px-0 text-sm font-medium hover:bg-transparent',
              isActive
                ? 'border-foreground text-foreground'
                : 'border-transparent text-foreground/70 hover:border-border hover:text-foreground'
            )}
            onClick={() => onFilterChange(filter.key)}
          >
            <span>{filter.label}</span>
            <Badge
              variant='outline'
              className={cn(
                'ml-1 size-5 rounded-full p-0 text-[10px]',
                isReviewWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300'
                  : isActive
                    ? 'border-border bg-background text-foreground'
                    : 'border-border/70 bg-muted/40 text-foreground/70'
              )}
            >
              {count}
            </Badge>
          </Button>
        );
      })}
    </div>
  );
}

function DocumentRequestSection({
  canReviewDocuments,
  group,
  highlightedId,
  isApproving,
  isReading,
  isRejecting,
  onApprove,
  onRead,
  onReject,
  onResolvedOpenChange,
  resolvedOpen
}: {
  canReviewDocuments: boolean;
  group: DocumentRequestGroup;
  highlightedId?: string | null;
  isApproving: boolean;
  isReading: boolean;
  isRejecting: boolean;
  onApprove: (requestId: string) => void;
  onRead: (versionId: string) => void;
  onReject: (request: ProductDocumentRequest) => void;
  onResolvedOpenChange?: (open: boolean) => void;
  resolvedOpen?: boolean;
}) {
  if (group.key === 'resolved') {
    return (
      // D4: controlled Collapsible — open/onOpenChange driven by PropertyDocumentRequests.
      <Collapsible open={resolvedOpen} onOpenChange={onResolvedOpenChange}>
        <div className='rounded-xl border bg-background/50'>
          <CollapsibleTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              className='h-auto w-full justify-between gap-3 rounded-xl px-4 py-3 text-left hover:no-underline'
            >
              <span className='flex min-w-0 flex-col items-start gap-0.5'>
                <span className='font-medium'>{group.title}</span>
                <span className='text-xs text-muted-foreground'>
                  {group.items.length} resueltas
                </span>
              </span>
              <Icons.chevronDown className='size-4 text-muted-foreground' />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <DocumentRequestList
              canReviewDocuments={canReviewDocuments}
              emptyCopy={group.emptyCopy}
              highlightedId={highlightedId}
              isApproving={isApproving}
              isReading={isReading}
              isRejecting={isRejecting}
              items={group.items}
              onApprove={onApprove}
              onRead={onRead}
              onReject={onReject}
            />
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  }

  return (
    <section className='space-y-2' aria-labelledby={`document-section-${group.key}`}>
      <div data-testid={`document-section-heading-${group.key}`}>
        <h4 id={`document-section-${group.key}`} className='text-sm font-semibold'>
          {group.title}
        </h4>
      </div>
      <DocumentRequestList
        canReviewDocuments={canReviewDocuments}
        emptyCopy={group.emptyCopy}
        highlightedId={highlightedId}
        isApproving={isApproving}
        isReading={isReading}
        isRejecting={isRejecting}
        items={group.items}
        onApprove={onApprove}
        onRead={onRead}
        onReject={onReject}
      />
    </section>
  );
}

function DocumentRequestList({
  canReviewDocuments,
  emptyCopy,
  highlightedId,
  isApproving,
  isReading,
  isRejecting,
  items,
  onApprove,
  onRead,
  onReject
}: {
  canReviewDocuments: boolean;
  emptyCopy: string;
  highlightedId?: string | null;
  isApproving: boolean;
  isReading: boolean;
  isRejecting: boolean;
  items: ProductDocumentRequest[];
  onApprove: (requestId: string) => void;
  onRead: (versionId: string) => void;
  onReject: (request: ProductDocumentRequest) => void;
}) {
  if (items.length === 0) {
    return (
      <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
        {emptyCopy}
      </p>
    );
  }

  return (
    <ul className='space-y-3 p-0 sm:p-0'>
      {items.map((request) => (
        <DocumentRequestItem
          key={request.id}
          canReviewDocuments={canReviewDocuments}
          isHighlighted={highlightedId === request.id}
          request={request}
          isApproving={isApproving}
          isReading={isReading}
          isRejecting={isRejecting}
          onApprove={onApprove}
          onRead={onRead}
          onReject={onReject}
        />
      ))}
    </ul>
  );
}

function DocumentRequestItem({
  canReviewDocuments,
  isApproving,
  isHighlighted,
  isReading,
  isRejecting,
  onApprove,
  onRead,
  onReject,
  request
}: {
  canReviewDocuments: boolean;
  isApproving: boolean;
  isHighlighted?: boolean;
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
    // D6: data-request-id is the DOM selector anchor for scroll/highlight.
    // isHighlighted adds a transient ring to make the deep-linked item stand out.
    <li
      data-request-id={request.id}
      className={cn(isHighlighted && 'ring-2 ring-primary rounded-xl')}
    >
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
    </li>
  );
}

function DocumentStatusBadge({ status }: { status: ProductDocumentRequestStatus }) {
  const config = documentStatusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Badge
      variant='outline'
      role='status'
      aria-label={`Estado del documento: ${config.label.toLowerCase()}`}
      className={cn('w-fit shrink-0 rounded-md', config.badgeClassName)}
    >
      <StatusIcon aria-hidden='true' className='size-3' />
      {config.label}
    </Badge>
  );
}

function RejectionReason({ reason }: { reason: string }) {
  return (
    <div className='rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm'>
      <p className='font-medium text-destructive'>Motivo de rechazo</p>
      <p className='mt-1 break-words text-foreground'>{reason}</p>
    </div>
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

function getCompactDocumentDescription(request: ProductDocumentRequest) {
  const description = request.description?.trim();

  if (!description) {
    return null;
  }

  const escapedTitle = escapeRegExp(request.title.trim());

  if (!escapedTitle) {
    return description;
  }

  const redundantSuffix = new RegExp(`\\s*:?\\s*${escapedTitle}\\s*$`, 'i');
  const compactDescription = description.replace(redundantSuffix, '').trim();

  return compactDescription || null;
}

function getPendingDocumentSummary(description: string | null) {
  const statusCopy = 'Esperando que el propietario suba el documento';

  return description ? `${statusCopy} · ${description}` : statusCopy;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRequestChronologyTimestamp(request: ProductDocumentRequest) {
  return (
    request.reviewedAt ??
    request.updatedAt ??
    request.currentVersion?.createdAt ??
    request.createdAt
  );
}

function getDocumentDisplayName(request: ProductDocumentRequest, version: ProductDocumentVersion) {
  const title = request.title.trim();

  if (title) {
    return title;
  }

  return getReadableFileName(version.originalFilename);
}

function getReadableFileName(fileName: string) {
  if (isTechnicalFileName(fileName)) {
    return 'Documento';
  }

  const nameWithoutExtension = fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return nameWithoutExtension || 'Documento';
}

function isTechnicalFileName(fileName: string) {
  const normalizedName = fileName.toLowerCase();

  return normalizedName.includes('seeded') || normalizedName.includes('smoke-document');
}

function getVersionMetadata(request: ProductDocumentRequest, version: ProductDocumentVersion) {
  const versionNumber = getVersionNumber(request, version);
  const fileFormat = getFileFormatLabel(version.mimeType);

  return versionNumber ? `v${versionNumber} · ${fileFormat}` : fileFormat;
}

function getVersionNumber(request: ProductDocumentRequest, version: ProductDocumentVersion) {
  const completedVersions = request.versions
    .filter((item) => item.status !== 'PENDING_UPLOAD')
    .toSorted((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  const index = completedVersions.findIndex((item) => item.id === version.id);

  return index >= 0 ? index + 1 : null;
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith('image/');
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

function getFileFormatLabel(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return 'PDF';
  }

  if (mimeType === 'image/jpeg') {
    return 'JPG';
  }

  if (mimeType === 'image/png') {
    return 'PNG';
  }

  if (mimeType === 'image/webp') {
    return 'WebP';
  }

  return 'Archivo';
}

function formatCompactDateTime(value: string) {
  return format(new Date(value), 'd MMM · HH:mm', { locale: es });
}
