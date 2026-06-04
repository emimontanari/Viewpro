import { Icons, type Icon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { OwnerDocumentRequestStatus } from '../api/types';

type OwnerDocumentStatusConfig = {
  /** Accessible label announced with the visible status so state is never color-only. */
  accessibleLabel: string;
  /** Tone classes for the decorative document-type chip in the card header. */
  iconChipClassName: string;
  /** Icon that reinforces the state in grayscale and for low-vision users. */
  icon: Icon;
  /** Visible status label. */
  label: string;
  /** Tone classes for the reusable status badge. */
  badgeClassName: string;
};

export const ownerDocumentStatusConfig = {
  APPROVED: {
    accessibleLabel: 'Estado del documento: aprobado',
    badgeClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
    icon: Icons.check,
    iconChipClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
    label: 'Aprobado'
  },
  CANCELLED: {
    accessibleLabel: 'Estado del documento: cancelado',
    badgeClassName:
      'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
    icon: Icons.circleX,
    iconChipClassName:
      'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
    label: 'Cancelado'
  },
  PENDING: {
    accessibleLabel: 'Estado del documento: pendiente',
    badgeClassName:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
    icon: Icons.clock,
    iconChipClassName:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200',
    label: 'Pendiente'
  },
  REJECTED: {
    accessibleLabel: 'Estado del documento: rechazado. Acción requerida.',
    badgeClassName:
      'border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive',
    icon: Icons.warning,
    iconChipClassName:
      'border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15 dark:text-destructive',
    label: 'Acción requerida'
  },
  SUBMITTED: {
    accessibleLabel: 'Estado del documento: en revisión',
    badgeClassName:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
    icon: Icons.upload,
    iconChipClassName:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-200',
    label: 'En revisión'
  }
} satisfies Record<OwnerDocumentRequestStatus, OwnerDocumentStatusConfig>;

export function OwnerDocumentStatusBadge({
  className,
  status
}: {
  className?: string;
  status: OwnerDocumentRequestStatus;
}) {
  const config = ownerDocumentStatusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Badge
      variant='outline'
      role='status'
      aria-label={config.accessibleLabel}
      className={cn('shrink-0 rounded-md', config.badgeClassName, className)}
    >
      <StatusIcon aria-hidden='true' className='size-3' />
      {config.label}
    </Badge>
  );
}
