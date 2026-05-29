'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  approveProductDocumentRequest,
  createProductDocumentReadUrl,
  createProductDocumentRequest,
  rejectProductDocumentRequest
} from '../api/service';
import { productDocumentRequestsOptions, productKeys } from '../api/queries';
import type {
  CreateProductDocumentRequestPayload,
  ProductDocumentRequest,
  ProductDocumentRequestStatus,
  ProductDocumentVersionStatus,
  PropertyLinkedOwner
} from '../api/types';
import { formatDateTime } from '../utils/format-date-time';
import { CreateDocumentRequestDialog } from './create-document-request-dialog';
import { RejectDocumentRequestDialog } from './reject-document-request-dialog';
import { cn } from '@/lib/utils';
import { useMemo, useState } from 'react';

type PropertyDocumentRequestsProps = {
  isArchived: boolean;
  owners: PropertyLinkedOwner[];
  productId: string;
  tenantId: string;
};

const documentStatusLabels: Record<ProductDocumentRequestStatus, string> = {
  APPROVED: 'Aprobado',
  CANCELLED: 'Cancelado',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazado',
  SUBMITTED: 'Subido'
};

const documentStatusTones: Record<ProductDocumentRequestStatus, string> = {
  APPROVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  CANCELLED:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
  PENDING:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  REJECTED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  SUBMITTED:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300'
};

const documentVersionStatusLabels: Record<ProductDocumentVersionStatus, string> = {
  APPROVED: 'Aprobada',
  PENDING_UPLOAD: 'Pendiente de subida',
  REJECTED: 'Rechazada',
  UPLOADED: 'Subida'
};

export function PropertyDocumentRequests({
  isArchived,
  owners,
  productId,
  tenantId
}: PropertyDocumentRequestsProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<ProductDocumentRequest | null>(null);
  const documentRequestsQueryKey = productKeys.documentRequests(productId, tenantId);
  const eligibleOwners = useMemo(() => owners.filter(isEligibleDocumentOwner), [owners]);
  const invitedOwnerCount = useMemo(
    () => eligibleOwners.filter((owner) => owner.accessStatus === 'INVITED').length,
    [eligibleOwners]
  );
  const documentRequestsQuery = useQuery(productDocumentRequestsOptions(productId, tenantId));
  const createDocumentRequestMutation = useMutation({
    mutationFn: (payload: CreateProductDocumentRequestPayload) =>
      createProductDocumentRequest(productId, payload),
    onSuccess: async () => {
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Solicitud de documento creada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo solicitar el documento');
    }
  });
  const readDocumentMutation = useMutation({
    mutationFn: (versionId: string) => createProductDocumentReadUrl(versionId),
    onSuccess: ({ readUrl }) => {
      window.open(readUrl.url, '_blank', 'noopener,noreferrer');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el documento');
    }
  });
  const approveDocumentMutation = useMutation({
    mutationFn: (requestId: string) => approveProductDocumentRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Documento aprobado');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo aprobar el documento');
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
      toast.error(error instanceof Error ? error.message : 'No se pudo rechazar el documento');
    }
  });

  function handleOpenDialog() {
    if (isArchived || eligibleOwners.length === 0 || createDocumentRequestMutation.isPending) {
      return;
    }

    setDialogOpen(true);
  }

  function handleSubmit(payload: CreateProductDocumentRequestPayload) {
    if (isArchived || createDocumentRequestMutation.isPending) {
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

  return (
    <section className='space-y-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <h3 className='text-base font-semibold'>Documentos</h3>
          <p className='text-sm text-muted-foreground'>
            Solicitudes documentales asociadas a esta propiedad.
          </p>
        </div>
        <Button
          type='button'
          variant='secondary'
          disabled={
            isArchived || eligibleOwners.length === 0 || createDocumentRequestMutation.isPending
          }
          onClick={handleOpenDialog}
        >
          <Icons.post className='size-4' />
          Solicitar documento
        </Button>
      </div>

      <DocumentRequestHint
        isArchived={isArchived}
        eligibleOwnerCount={eligibleOwners.length}
        invitedOwnerCount={invitedOwnerCount}
        linkedOwnerCount={owners.length}
      />

      <div className='rounded-2xl border bg-card p-4 shadow-xs'>
        {documentRequestsQuery.isLoading ? <DocumentRequestsLoadingState /> : null}
        {documentRequestsQuery.isError ? <DocumentRequestsErrorState /> : null}
        {!documentRequestsQuery.isLoading &&
        !documentRequestsQuery.isError &&
        (documentRequestsQuery.data?.items.length ?? 0) === 0 ? (
          <DocumentRequestsEmptyState />
        ) : null}
        {!documentRequestsQuery.isLoading &&
        !documentRequestsQuery.isError &&
        (documentRequestsQuery.data?.items.length ?? 0) > 0 ? (
          <ul className='space-y-3'>
            {documentRequestsQuery.data?.items.map((request) => (
              <DocumentRequestItem
                key={request.id}
                owners={owners}
                request={request}
                isApproving={approveDocumentMutation.isPending}
                isReading={readDocumentMutation.isPending}
                isRejecting={rejectDocumentMutation.isPending}
                onApprove={(requestId) => approveDocumentMutation.mutate(requestId)}
                onRead={(versionId) => readDocumentMutation.mutate(versionId)}
                onReject={setRequestToReject}
              />
            ))}
          </ul>
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
  eligibleOwnerCount,
  invitedOwnerCount,
  isArchived,
  linkedOwnerCount
}: {
  eligibleOwnerCount: number;
  invitedOwnerCount: number;
  isArchived: boolean;
  linkedOwnerCount: number;
}) {
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

function DocumentRequestItem({
  isApproving,
  isReading,
  isRejecting,
  onApprove,
  onRead,
  onReject,
  owners,
  request
}: {
  isApproving: boolean;
  isReading: boolean;
  isRejecting: boolean;
  onApprove: (requestId: string) => void;
  onRead: (versionId: string) => void;
  onReject: (request: ProductDocumentRequest) => void;
  owners: PropertyLinkedOwner[];
  request: ProductDocumentRequest;
}) {
  const owner = owners.find(
    (item) =>
      item.id === request.propertyAssetOwnerId ||
      (request.propertyAssetOwnerId === null && item.userId === request.ownerUserId)
  );
  const ownerName = owner ? getOwnerDisplayName(owner) : 'Propietario';
  const canReview = request.status === 'SUBMITTED' && request.currentVersion !== null;
  const reviewActionsDisabled = isApproving || isReading || isRejecting;

  return (
    <li className='space-y-3 rounded-xl border bg-background p-3'>
      <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant='outline'
              className={cn('rounded-md', documentStatusTones[request.status])}
            >
              {documentStatusLabels[request.status]}
            </Badge>
            <span className='text-xs text-muted-foreground'>
              {formatDateTime(request.createdAt)}
            </span>
          </div>
          <h4 className='break-words text-sm font-semibold'>{request.title}</h4>
          {request.description ? (
            <p className='whitespace-pre-wrap break-words text-sm text-muted-foreground'>
              {request.description}
            </p>
          ) : null}
        </div>
        <div className='shrink-0 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground'>
          Para {ownerName}
        </div>
      </div>

      {request.rejectionReason ? (
        <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'>
          <span className='font-medium'>Motivo de rechazo: </span>
          <span className='break-words'>{request.rejectionReason}</span>
        </div>
      ) : null}

      {request.currentVersion ? (
        <div className='flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 text-sm lg:flex-row lg:items-center lg:justify-between'>
          <div className='min-w-0'>
            <p className='break-words font-medium'>{request.currentVersion.originalFilename}</p>
            <p className='text-xs text-muted-foreground'>Versión actual del documento</p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant='outline' className='w-fit rounded-md bg-background'>
              {documentVersionStatusLabels[request.currentVersion.status]}
            </Badge>
            {canReview ? (
              <>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={reviewActionsDisabled}
                  onClick={() => onRead(request.currentVersion!.id)}
                >
                  <Icons.externalLink className='size-4' />
                  Abrir documento
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='secondary'
                  disabled={reviewActionsDisabled}
                  onClick={() => onApprove(request.id)}
                >
                  <Icons.check className='size-4' />
                  Aprobar
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='destructive'
                  disabled={reviewActionsDisabled}
                  onClick={() => onReject(request)}
                >
                  <Icons.close className='size-4' />
                  Rechazar
                </Button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function isEligibleDocumentOwner(owner: PropertyLinkedOwner) {
  return owner.accessStatus === 'INVITED' || owner.accessStatus === 'ACTIVE';
}

function getOwnerDisplayName(owner: {
  email: string;
  firstName: string | null;
  lastName?: string | null;
  ownerFirstName?: string;
  ownerLastName?: string;
}) {
  const snapshotName = [owner.ownerFirstName, owner.ownerLastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');
  const userName = [owner.firstName, owner.lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  return snapshotName || userName || owner.email;
}
