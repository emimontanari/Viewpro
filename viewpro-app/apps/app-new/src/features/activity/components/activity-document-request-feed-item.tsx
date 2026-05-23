import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  getOperationTone,
  getOperationTypeLabel,
  getStatusLabel,
  getStatusTone
} from '@/features/products/components/product-tables/columns';
import { formatDateTime } from '@/features/products/utils/format-date-time';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ActivityDocumentRequestItem } from '../api/types';

const documentStatusLabels: Record<
  ActivityDocumentRequestItem['documentRequest']['status'],
  string
> = {
  APPROVED: 'Aprobada',
  CANCELLED: 'Cancelada',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazada',
  SUBMITTED: 'Subida'
};

const documentStatusTones: Record<
  ActivityDocumentRequestItem['documentRequest']['status'],
  string
> = {
  APPROVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  CANCELLED: 'border-muted bg-muted/50 text-muted-foreground',
  PENDING:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  REJECTED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  SUBMITTED:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300'
};

const versionStatusLabels: Record<
  NonNullable<ActivityDocumentRequestItem['documentRequest']['currentVersion']>['status'],
  string
> = {
  APPROVED: 'Aprobada',
  PENDING_UPLOAD: 'Pendiente de carga',
  REJECTED: 'Rechazada',
  UPLOADED: 'Subida'
};

export function ActivityDocumentRequestFeedItem({ item }: { item: ActivityDocumentRequestItem }) {
  const propertyTitle = item.property.title?.trim() || 'Propiedad sin título';
  const address = formatAddress(item);
  const ownerLabel = item.owner ? getOwnerDisplayName(item.owner) : 'Propietario';
  const requesterLabel = getRequesterDisplayName(item);
  const documentRequest = item.documentRequest;
  const currentVersion = documentRequest?.currentVersion ?? null;
  const documentStatusLabel = documentRequest
    ? documentStatusLabels[documentRequest.status]
    : 'Solicitud no disponible';
  const documentStatusTone = documentRequest
    ? documentStatusTones[documentRequest.status]
    : 'border-muted bg-muted/50 text-muted-foreground';

  return (
    <Card className='overflow-hidden py-0 transition-colors hover:border-primary/30'>
      <CardContent className='p-0'>
        <div className='grid lg:grid-cols-[minmax(0,1fr)_13.5rem]'>
          <div className='space-y-4 p-4 sm:p-5'>
            <div className='flex gap-4'>
              <div className='hidden size-12 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-muted-foreground sm:flex'>
                <Icons.post className='size-6' />
              </div>
              <div className='min-w-0 flex-1 space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline' className='rounded-full bg-muted/40'>
                    Solicitud documental
                  </Badge>
                  <Badge variant='outline' className={cn('rounded-full', documentStatusTone)}>
                    {documentStatusLabel}
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
                <div className='min-w-0 space-y-1'>
                  <h3 className='line-clamp-2 break-words text-base font-semibold leading-snug'>
                    {propertyTitle}
                  </h3>
                  {address ? (
                    <p className='line-clamp-1 text-sm text-muted-foreground'>{address}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div className='min-w-0 rounded-xl border bg-muted/20 p-3'>
                <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                  <Icons.post className='size-4 shrink-0' />
                  Documento solicitado
                </div>
                <p className='mt-1 line-clamp-2 break-words text-sm font-medium leading-6'>
                  {documentRequest?.title ?? 'Solicitud documental no disponible'}
                </p>
                {documentRequest?.description ? (
                  <p className='mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground'>
                    {documentRequest.description}
                  </p>
                ) : null}
              </div>

              <div className='min-w-0 rounded-xl border bg-muted/20 p-3'>
                <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
                  <Icons.fileTypePdf className='size-4 shrink-0' />
                  Estado del archivo
                </div>
                {currentVersion ? (
                  <div className='mt-1 space-y-1'>
                    <p className='line-clamp-1 break-words text-sm font-medium leading-6'>
                      {currentVersion.originalFilename}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {versionStatusLabels[currentVersion.status]}
                    </p>
                  </div>
                ) : (
                  <p className='mt-1 text-sm font-medium leading-6'>Sin archivo cargado</p>
                )}
              </div>
            </div>

            <div className='grid gap-3 border-t pt-3 text-sm text-muted-foreground sm:grid-cols-2'>
              <ActivityMeta
                icon={<Icons.user className='size-4' />}
                label='Propietario'
                value={ownerLabel}
              />
              <ActivityMeta
                icon={<Icons.teams className='size-4' />}
                label='Solicitado por'
                value={requesterLabel}
              />
            </div>
          </div>

          <div className='flex flex-col gap-3 border-t p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-end lg:justify-start lg:border-l lg:border-t-0 lg:p-5'>
            <div className='flex items-center gap-2 whitespace-nowrap lg:justify-end'>
              <Icons.calendar className='size-4 shrink-0' />
              <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
            </div>
            <Button asChild variant='outline' size='sm' className='lg:w-full'>
              <Link href={`/dashboard/product/${item.property.engagementId}`}>
                Ver propiedad
                <Icons.arrowRight className='size-4' />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityMeta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className='flex min-w-0 items-center gap-2'>
      <span className='shrink-0 text-muted-foreground'>{icon}</span>
      <div className='min-w-0 space-y-0.5'>
        <p className='text-xs'>{label}</p>
        <p className='truncate font-medium text-foreground' title={value}>
          {value}
        </p>
      </div>
    </div>
  );
}

function formatAddress(item: ActivityDocumentRequestItem) {
  return [item.property.addressLine, item.property.city, item.property.province]
    .filter(Boolean)
    .join(', ');
}

function getRequesterDisplayName(item: ActivityDocumentRequestItem) {
  return item.requestedBy?.firstName || item.requestedBy?.email || 'Solicitante no disponible';
}

function getOwnerDisplayName(owner: NonNullable<ActivityDocumentRequestItem['owner']>) {
  const snapshotName = [owner.ownerFirstName, owner.ownerLastName]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
  const userName = [owner.firstName, owner.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  return snapshotName || userName || owner.email;
}
