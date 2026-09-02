import { Icons, type Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
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
