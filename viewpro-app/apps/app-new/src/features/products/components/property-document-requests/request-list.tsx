import { Icons, type Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  formatCompactDateTime,
  getCompactDocumentDescription,
  getPendingDocumentSummary,
  getRequestChronologyTimestamp
} from './model';
import type { ReactNode } from 'react';
import type { ProductDocumentRequest, ProductDocumentRequestStatus } from '../../api/types';
import type { DocumentRequestGroup } from './model';

type DocumentStatusConfig = {
  badgeClassName: string;
  icon: Icon;
  label: string;
};

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

type DocumentRequestSectionProps = {
  children: ReactNode;
  group: DocumentRequestGroup;
  onResolvedOpenChange: (open: boolean) => void;
  resolvedOpen: boolean;
};

type DocumentRequestListProps = {
  emptyCopy: string;
  highlightedId?: string | null;
  items: ProductDocumentRequest[];
  renderItem: (request: ProductDocumentRequest) => ReactNode;
};

export function DocumentRequestList({
  emptyCopy,
  highlightedId,
  items,
  renderItem
}: DocumentRequestListProps) {
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
        <li
          key={request.id}
          data-request-id={request.id}
          className={cn(highlightedId === request.id && 'ring-2 ring-primary rounded-xl')}
        >
          {renderItem(request)}
        </li>
      ))}
    </ul>
  );
}

export function DocumentStatusBadge({ status }: { status: ProductDocumentRequestStatus }) {
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

export function RejectionReason({ reason }: { reason: string }) {
  return (
    <div className='rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm'>
      <p className='font-medium text-destructive'>Motivo de rechazo</p>
      <p className='mt-1 break-words text-foreground'>{reason}</p>
    </div>
  );
}

export function DocumentRequestSection({
  children,
  group,
  onResolvedOpenChange,
  resolvedOpen
}: DocumentRequestSectionProps) {
  if (group.key === 'resolved') {
    return (
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
          <CollapsibleContent>{children}</CollapsibleContent>
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
      {children}
    </section>
  );
}

export function DocumentRequestItem({
  canReviewDocuments,
  isApproving,
  isReading,
  isRejecting,
  onApprove,
  onRead,
  onReject,
  request,
  versionSummary
}: {
  canReviewDocuments: boolean;
  isApproving: boolean;
  isReading: boolean;
  isRejecting: boolean;
  onApprove: (requestId: string) => void;
  onRead: (versionId: string) => void;
  onReject: (request: ProductDocumentRequest) => void;
  request: ProductDocumentRequest;
  versionSummary: ReactNode;
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

        {versionSummary}

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
