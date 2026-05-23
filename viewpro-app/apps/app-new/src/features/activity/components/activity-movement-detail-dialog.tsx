import type React from 'react';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  getOperationTone,
  getOperationTypeLabel,
  getStatusLabel,
  getStatusTone
} from '@/features/products/components/product-tables/columns';
import { getMovementTypeLabel } from '@/features/products/constants/movement-options';
import { formatDateTime } from '@/features/products/utils/format-date-time';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ActivityMovementItem } from '../api/types';

export function ActivityMovementDetailDialog({
  item,
  onOpenChange,
  open
}: {
  item: ActivityMovementItem | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const propertyTitle = item?.property.title?.trim() || 'Propiedad sin título';
  const address = item ? formatAddress(item) : '';
  const actor = item ? item.createdBy.firstName || item.createdBy.email : '';
  const statusChange = item ? getMovementStatusChange(item) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {item ? (
        <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Detalle de la actualización</DialogTitle>
            <DialogDescription>
              Información completa del seguimiento registrado para esta propiedad.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-5'>
            <section className='space-y-3 rounded-2xl border bg-muted/20 p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline' className='rounded-full bg-background'>
                  {getMovementTypeLabel(item.type)}
                </Badge>
                <Badge
                  variant='outline'
                  className={cn('rounded-full', getOperationTone(item.property.operationType))}
                >
                  {getOperationTypeLabel(item.property.operationType)}
                </Badge>
                <Badge
                  variant='outline'
                  className={cn('rounded-full', getStatusTone(item.property.status))}
                >
                  {getStatusLabel(item.property.status)}
                </Badge>
              </div>

              <div>
                <h3 className='break-words text-base font-semibold'>{propertyTitle}</h3>
                {address ? <p className='mt-1 text-sm text-muted-foreground'>{address}</p> : null}
              </div>
            </section>

            <div className='grid gap-3 sm:grid-cols-2'>
              <DetailField icon={<Icons.clock className='size-4' />} label='Fecha'>
                <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
              </DetailField>
              <DetailField icon={<Icons.user className='size-4' />} label='Registrado por'>
                {actor}
              </DetailField>
            </div>

            <section className='space-y-2'>
              <h4 className='text-sm font-semibold'>Observación</h4>
              <p className='whitespace-pre-wrap break-words rounded-2xl border bg-card p-4 text-sm leading-6'>
                {item.observation}
              </p>
            </section>

            {item.nextStep ? (
              <section className='space-y-2'>
                <h4 className='text-sm font-semibold'>Próximo paso</h4>
                <p className='whitespace-pre-wrap break-words rounded-2xl border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground'>
                  {item.nextStep}
                </p>
              </section>
            ) : null}

            {statusChange ? (
              <section className='space-y-2'>
                <h4 className='text-sm font-semibold'>Cambio de estado</h4>
                <StatusChangeCard change={statusChange} />
              </section>
            ) : null}

            <section className='space-y-2'>
              <h4 className='text-sm font-semibold'>Vendedores asignados</h4>
              {item.property.agents.length > 0 ? (
                <ul className='space-y-2'>
                  {item.property.agents.map((agent) => (
                    <li key={agent.id} className='rounded-xl border p-3 text-sm'>
                      <p className='font-medium'>{agent.firstName || agent.email}</p>
                      <p className='break-all text-muted-foreground'>{agent.email}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className='rounded-xl border border-dashed p-3 text-sm text-muted-foreground'>
                  Sin vendedores asignados.
                </p>
              )}
            </section>
          </div>

          <DialogFooter>
            <Button asChild>
              <Link href={`/dashboard/product/${item.property.engagementId}`}>
                Abrir propiedad
                <Icons.externalLink className='size-4' />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DetailField({
  children,
  icon,
  label
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className='rounded-2xl border bg-card p-4'>
      <div className='mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {icon}
        {label}
      </div>
      <div className='break-words text-sm font-medium'>{children}</div>
    </div>
  );
}

function StatusChangeCard({
  change
}: {
  change: { fromLabel: string; fromTone: string; toLabel: string; toTone: string };
}) {
  return (
    <div className='rounded-2xl border bg-gradient-to-br from-muted/40 via-background to-muted/20 p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <StatusPill label={change.fromLabel} tone={change.fromTone} eyebrow='Antes' />
        <div className='flex items-center justify-center text-muted-foreground sm:px-1'>
          <span
            aria-hidden='true'
            className='flex size-8 items-center justify-center rounded-full border bg-background shadow-xs'
          >
            <Icons.arrowRight className='size-4' />
          </span>
        </div>
        <StatusPill label={change.toLabel} tone={change.toTone} eyebrow='Ahora' />
      </div>
    </div>
  );
}

function StatusPill({ eyebrow, label, tone }: { eyebrow: string; label: string; tone: string }) {
  return (
    <div className='min-w-0 flex-1 rounded-xl border bg-background p-3 shadow-xs'>
      <p className='mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {eyebrow}
      </p>
      <Badge variant='outline' className={cn('rounded-md px-2.5 py-1 text-sm', tone)}>
        {label}
      </Badge>
    </div>
  );
}

function getMovementStatusChange(item: ActivityMovementItem) {
  if (!item.newStatus) {
    return null;
  }

  return {
    fromLabel: item.previousStatus ? getStatusLabel(item.previousStatus) : 'Sin estado anterior',
    fromTone: item.previousStatus ? getStatusTone(item.previousStatus) : 'border-muted bg-muted/50',
    toLabel: getStatusLabel(item.newStatus),
    toTone: getStatusTone(item.newStatus)
  };
}

function formatAddress(item: ActivityMovementItem) {
  return [item.property.addressLine, item.property.city, item.property.province]
    .filter(Boolean)
    .join(', ');
}
