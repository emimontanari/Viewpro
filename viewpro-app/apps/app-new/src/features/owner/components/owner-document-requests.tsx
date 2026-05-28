'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useRef } from 'react';
import { toast } from 'sonner';
import { ownerDocumentRequestsOptions, ownerKeys } from '../api/queries';
import {
  confirmOwnerDocumentUpload,
  createOwnerDocumentReadUrl,
  createOwnerDocumentUploadUrl,
  uploadOwnerDocumentFile
} from '../api/service';
import type {
  OwnerDocumentRequest,
  OwnerDocumentRequestStatus,
  OwnerDocumentVersionStatus
} from '../api/types';

const OWNER_DOCUMENT_FILTERS = { pageSize: 20 };

const documentStatusLabels: Record<OwnerDocumentRequestStatus, string> = {
  APPROVED: 'Aprobado',
  CANCELLED: 'Cancelado',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazado',
  SUBMITTED: 'Subido'
};

const documentStatusTones: Record<OwnerDocumentRequestStatus, string> = {
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

const documentVersionStatusLabels: Record<OwnerDocumentVersionStatus, string> = {
  APPROVED: 'Aprobada',
  PENDING_UPLOAD: 'Pendiente de subida',
  REJECTED: 'Rechazada',
  UPLOADED: 'Subida'
};

export function OwnerDocumentRequests({ propertyEngagementId }: { propertyEngagementId: string }) {
  const queryClient = useQueryClient();
  const documentRequestsQuery = useQuery(
    ownerDocumentRequestsOptions(propertyEngagementId, OWNER_DOCUMENT_FILTERS)
  );
  const documentRequestsQueryKey = ownerKeys.documentRequests(
    propertyEngagementId,
    OWNER_DOCUMENT_FILTERS
  );
  const uploadMutation = useMutation({
    mutationFn: async ({ file, requestId }: { file: File; requestId: string }) => {
      if (!file.type) {
        throw new Error('El tipo de archivo es requerido para subir documentos.');
      }

      if (file.size < 1) {
        throw new Error('El archivo está vacío.');
      }

      const { uploadUrl, version } = await createOwnerDocumentUploadUrl(requestId, {
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });

      await uploadOwnerDocumentFile(uploadUrl, file, { mimeType: file.type });
      return confirmOwnerDocumentUpload(version.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Documento subido correctamente');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo subir el documento');
    }
  });
  const readMutation = useMutation({
    mutationFn: (versionId: string) => createOwnerDocumentReadUrl(versionId),
    onSuccess: ({ readUrl }) => {
      window.open(readUrl.url, '_blank', 'noopener,noreferrer');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo abrir el documento');
    }
  });

  return (
    <section className='space-y-3'>
      <div className='flex flex-col gap-1'>
        <h3 className='text-base font-semibold'>Documentos</h3>
        <p className='text-sm text-muted-foreground'>
          Documentación solicitada por la inmobiliaria para esta gestión.
        </p>
      </div>

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
              <OwnerDocumentRequestItem
                key={request.id}
                request={request}
                isUploading={uploadMutation.isPending}
                isReading={readMutation.isPending}
                onRead={(versionId) => readMutation.mutate(versionId)}
                onUpload={(requestId, file) => uploadMutation.mutate({ file, requestId })}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function OwnerDocumentRequestItem({
  isReading,
  isUploading,
  onRead,
  onUpload,
  request
}: {
  isReading: boolean;
  isUploading: boolean;
  onRead: (versionId: string) => void;
  onUpload: (requestId: string, file: File) => void;
  request: OwnerDocumentRequest;
}) {
  const canUpload = request.status === 'PENDING' || request.status === 'REJECTED';
  const canRead =
    (request.status === 'SUBMITTED' || request.status === 'APPROVED') && request.currentVersion;
  const uploadLabel =
    request.status === 'REJECTED' ? 'Volver a subir documento' : 'Subir documento';
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file || isUploading) {
      return;
    }

    onUpload(request.id, file);
  }

  function handleUploadClick() {
    if (isUploading) {
      return;
    }

    inputRef.current?.click();
  }

  return (
    <li className='space-y-3 rounded-xl border bg-background p-3'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant='outline'
              className={cn('rounded-md', documentStatusTones[request.status])}
            >
              {documentStatusLabels[request.status]}
            </Badge>
            <span className='text-xs text-muted-foreground'>Solicitado por la inmobiliaria</span>
          </div>
          <h4 className='break-words text-sm font-semibold'>{request.title}</h4>
          {request.description ? (
            <p className='whitespace-pre-wrap break-words text-sm text-muted-foreground'>
              {request.description}
            </p>
          ) : null}
        </div>

        <div className='flex shrink-0 flex-wrap gap-2'>
          {canUpload ? (
            <>
              <input
                ref={inputRef}
                aria-label={`${uploadLabel} archivo`}
                className='sr-only'
                disabled={isUploading}
                tabIndex={-1}
                type='file'
                onChange={handleFileChange}
              />
              <Button
                type='button'
                size='sm'
                variant='secondary'
                disabled={isUploading}
                onClick={handleUploadClick}
              >
                <Icons.upload className='size-4' />
                {uploadLabel}
              </Button>
            </>
          ) : null}

          {canRead ? (
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={isReading}
              onClick={() => onRead(request.currentVersion!.id)}
            >
              <Icons.externalLink className='size-4' />
              Abrir documento
            </Button>
          ) : null}
        </div>
      </div>

      {request.rejectionReason ? (
        <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'>
          <span className='font-medium'>Motivo de rechazo: </span>
          <span className='break-words'>{request.rejectionReason}</span>
        </div>
      ) : null}

      {request.currentVersion ? (
        <div className='flex flex-col gap-1 rounded-lg border bg-muted/20 p-3 text-sm sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            <p className='break-words font-medium'>{request.currentVersion.originalFilename}</p>
            <p className='text-xs text-muted-foreground'>Versión actual del documento</p>
          </div>
          <Badge variant='outline' className='w-fit rounded-md bg-background'>
            {documentVersionStatusLabels[request.currentVersion.status]}
          </Badge>
        </div>
      ) : null}
    </li>
  );
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
