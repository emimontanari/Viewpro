'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { IconHome, IconId, type IconProps } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, type ComponentType, useRef, useState } from 'react';
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
  OwnerDocumentVersion,
  OwnerDocumentVersionStatus
} from '../api/types';
import { OwnerDocumentUploadDialog, type OwnerUploadPhase } from './owner-document-upload-dialog';

const OWNER_DOCUMENT_FILTERS = { pageSize: 20 };
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);
const ACCEPTED_UPLOAD_INPUT_TYPES = 'application/pdf,image/jpeg,image/png,image/webp';

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
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300'
};

const documentVersionStatusTones: Record<OwnerDocumentVersionStatus, string> = {
  APPROVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  PENDING_UPLOAD:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  REJECTED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  UPLOADED:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300'
};

const documentCardBorderTones: Record<OwnerDocumentRequestStatus, string> = {
  APPROVED: 'border-[#1a4028]',
  CANCELLED: 'border-zinc-700',
  PENDING: 'border-amber-600',
  REJECTED: 'border-[#5a2020]',
  SUBMITTED: 'border-blue-700'
};

const documentIconChipTones: Record<OwnerDocumentRequestStatus, string> = {
  APPROVED:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
  CANCELLED:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
  PENDING:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200',
  REJECTED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200',
  SUBMITTED:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-200'
};

type DocumentIcon = ComponentType<IconProps>;

const documentVersionStatusLabels: Record<OwnerDocumentVersionStatus, string> = {
  APPROVED: 'Aprobada',
  PENDING_UPLOAD: 'Pendiente de subida',
  REJECTED: 'Rechazada',
  UPLOADED: 'Subida'
};

type SelectedUpload = {
  file: File;
  requestId: string;
  requestTitle: string;
};

export function OwnerDocumentRequests({
  agencyName = 'la inmobiliaria',
  propertyEngagementId
}: {
  agencyName?: string;
  propertyEngagementId: string;
}) {
  const queryClient = useQueryClient();
  const [selectedUpload, setSelectedUpload] = useState<SelectedUpload | null>(null);
  const [fileSelectionError, setFileSelectionError] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<OwnerUploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const documentRequestsQuery = useQuery(
    ownerDocumentRequestsOptions(propertyEngagementId, OWNER_DOCUMENT_FILTERS)
  );
  const documentRequestsQueryKey = ownerKeys.documentRequests(
    propertyEngagementId,
    OWNER_DOCUMENT_FILTERS
  );
  const uploadMutation = useMutation({
    mutationFn: async ({ file, requestId }: { file: File; requestId: string }) => {
      assertValidUploadFile(file);
      setUploadPhase('preparing');
      setUploadProgress(10);

      const { uploadUrl, version } = await createOwnerDocumentUploadUrl(requestId, {
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes: file.size
      });

      setUploadPhase('uploading');
      setUploadProgress(35);
      await uploadOwnerDocumentFile(uploadUrl, file, {
        mimeType: file.type,
        onProgress: (progress) => setUploadProgress(progress.percent)
      });

      setUploadPhase('confirming');
      setUploadProgress(90);
      return confirmOwnerDocumentUpload(version.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: documentRequestsQueryKey });
      toast.success('Documento subido correctamente');
      clearUploadDialog();
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo subir el documento';
      setUploadPhase('idle');
      setUploadProgress(0);
      setUploadErrorMessage(message);
      toast.error(message);
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

  function clearUploadDialog() {
    setSelectedUpload(null);
    setUploadErrorMessage(null);
    setUploadPhase('idle');
    setUploadProgress(0);
  }

  function handleCancelUpload() {
    if (uploadMutation.isPending) {
      return;
    }

    clearUploadDialog();
  }

  function handleSelectedUpload(request: OwnerDocumentRequest, file: File) {
    if (uploadMutation.isPending) {
      return;
    }

    const validationError = getUploadFileValidationError(file);
    if (validationError) {
      setFileSelectionError(validationError);
      setSelectedUpload(null);
      setUploadErrorMessage(null);
      return;
    }

    setFileSelectionError(null);
    setUploadErrorMessage(null);
    setUploadPhase('idle');
    setUploadProgress(0);
    setSelectedUpload({ file, requestId: request.id, requestTitle: request.title });
  }

  function handleConfirmUpload() {
    if (!selectedUpload || uploadMutation.isPending) {
      return;
    }

    setUploadErrorMessage(null);
    uploadMutation.mutate({ file: selectedUpload.file, requestId: selectedUpload.requestId });
  }

  return (
    <section className='space-y-3'>
      <div className='flex flex-col gap-1'>
        <h3 className='text-base font-semibold'>Documentos</h3>
        <p className='text-sm text-muted-foreground'>
          Documentación solicitada por la inmobiliaria para esta gestión.
        </p>
      </div>

      <div className='rounded-2xl border bg-card p-4 shadow-xs'>
        {fileSelectionError ? (
          <div
            role='alert'
            className='mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
          >
            {fileSelectionError}
          </div>
        ) : null}
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
                agencyName={agencyName}
                request={request}
                isUploading={uploadMutation.isPending}
                isReading={readMutation.isPending}
                onRead={(versionId) => readMutation.mutate(versionId)}
                onUpload={(uploadRequest, file) => handleSelectedUpload(uploadRequest, file)}
              />
            ))}
          </ul>
        ) : null}
      </div>

      <OwnerDocumentUploadDialog
        open={selectedUpload !== null}
        file={selectedUpload?.file ?? null}
        requestTitle={selectedUpload?.requestTitle}
        isUploading={uploadMutation.isPending}
        uploadPhase={uploadPhase}
        progress={uploadProgress}
        errorMessage={uploadErrorMessage}
        onCancel={handleCancelUpload}
        onConfirm={handleConfirmUpload}
      />
    </section>
  );
}

function OwnerDocumentRequestItem({
  agencyName,
  isReading,
  isUploading,
  onRead,
  onUpload,
  request
}: {
  agencyName: string;
  isReading: boolean;
  isUploading: boolean;
  onRead: (versionId: string) => void;
  onUpload: (request: OwnerDocumentRequest, file: File) => void;
  request: OwnerDocumentRequest;
}) {
  const canUpload = request.status === 'PENDING' || request.status === 'REJECTED';
  const canRead =
    (request.status === 'SUBMITTED' || request.status === 'APPROVED') && request.currentVersion;
  const uploadLabel =
    request.status === 'REJECTED' ? 'Volver a subir documento' : 'Subir documento';
  const currentVersion = request.currentVersion;
  const historicalVersions = getHistoricalVersions(request);
  const documentTypeLabel = getDocumentTypeLabel(request.title);
  const HeaderIcon = getDocumentHeaderIcon(request.title);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file || isUploading) {
      return;
    }

    onUpload(request, file);
  }

  function handleUploadClick() {
    if (isUploading) {
      return;
    }

    inputRef.current?.click();
  }

  return (
    <li
      className={cn(
        'overflow-hidden rounded-xl border bg-background shadow-xs',
        documentCardBorderTones[request.status]
      )}
    >
      <div className='space-y-4 p-4'>
        <div
          data-testid='owner-document-card-header'
          className='flex items-start justify-between gap-3'
        >
          <div className='flex min-w-0 items-start gap-3'>
            <span
              aria-hidden='true'
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl border',
                documentIconChipTones[request.status]
              )}
            >
              <HeaderIcon className='size-5' />
            </span>
            <div className='min-w-0 space-y-1'>
              <h4 className='break-words text-sm font-semibold'>{request.title}</h4>
              <p className='break-words text-xs text-muted-foreground'>
                {documentTypeLabel} · Solicitado por {agencyName}
              </p>
            </div>
          </div>
          <Badge
            variant='outline'
            className={cn('shrink-0 rounded-md', documentStatusTones[request.status])}
          >
            {documentStatusLabels[request.status]}
          </Badge>
        </div>

        {request.description ? (
          <p className='whitespace-pre-wrap break-words text-sm text-muted-foreground'>
            {request.description}
          </p>
        ) : null}

        {currentVersion ? (
          <DocumentVersionRow label='Versión actual del documento' version={currentVersion} />
        ) : null}

        {historicalVersions.length > 0 ? (
          <div className='space-y-2 rounded-lg border border-dashed bg-muted/10 p-3'>
            <p className='text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase'>
              Historial de versiones
            </p>
            <div className='space-y-2'>
              {historicalVersions.map((version) => (
                <DocumentVersionRow
                  key={version.id}
                  label='Versión anterior'
                  version={version}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {request.status === 'REJECTED' && request.rejectionReason ? (
        <div
          role='alert'
          className='flex gap-3 border-t border-red-900/70 bg-[#190b0b] px-4 py-3 text-red-100'
        >
          <Icons.warning className='mt-0.5 size-5 shrink-0 text-red-300' />
          <div className='min-w-0 space-y-1'>
            <p className='text-[11px] font-semibold tracking-[0.12em] text-red-300 uppercase'>
              MOTIVO DEL RECHAZO
            </p>
            <p className='break-words text-sm'>{request.rejectionReason}</p>
          </div>
        </div>
      ) : null}

      {canUpload || canRead ? (
        <div className='border-t bg-background p-4'>
          {canUpload ? (
            <>
              <input
                ref={inputRef}
                aria-label={`${uploadLabel} archivo`}
                accept={ACCEPTED_UPLOAD_INPUT_TYPES}
                className='sr-only'
                disabled={isUploading}
                tabIndex={-1}
                type='file'
                onChange={handleFileChange}
              />
              <Button
                type='button'
                className='w-full bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-500 dark:hover:bg-purple-400'
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
              variant='outline'
              className='w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-200 dark:hover:bg-blue-900/60'
              disabled={isReading}
              onClick={() => onRead(request.currentVersion!.id)}
            >
              <Icons.externalLink className='size-4' />
              Abrir documento
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function DocumentVersionRow({
  label,
  version
}: {
  label: string;
  version: OwnerDocumentVersion;
}) {
  const FileIcon = getDocumentFileIcon(version.mimeType);

  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3 text-sm'>
      <div className='flex min-w-0 items-center gap-3'>
        <span
          aria-hidden='true'
          className='flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground'
        >
          <FileIcon className='size-5' />
        </span>
        <div className='min-w-0'>
          <p className='break-words font-medium'>{version.originalFilename}</p>
          <p className='text-xs text-muted-foreground'>{label}</p>
        </div>
      </div>
      <Badge
        variant='outline'
        className={cn('shrink-0 rounded-md', documentVersionStatusTones[version.status])}
      >
        {documentVersionStatusLabels[version.status]}
      </Badge>
    </div>
  );
}

function getHistoricalVersions(request: OwnerDocumentRequest) {
  return request.versions
    .filter((version) => version.id !== request.currentVersion?.id)
    .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function getDocumentTypeLabel(title: string) {
  const normalizedTitle = normalizeSearchText(title);

  if (normalizedTitle.includes('dni') || normalizedTitle.includes('identidad')) {
    return 'DNI';
  }

  if (normalizedTitle.includes('escritura')) {
    return 'Escritura';
  }

  return title;
}

function getDocumentHeaderIcon(title: string): DocumentIcon {
  const normalizedTitle = normalizeSearchText(title);

  if (normalizedTitle.includes('dni') || normalizedTitle.includes('identidad')) {
    return IconId;
  }

  if (normalizedTitle.includes('escritura')) {
    return IconHome;
  }

  return Icons.post;
}

function getDocumentFileIcon(mimeType: string): DocumentIcon {
  if (mimeType === 'application/pdf') {
    return Icons.fileTypePdf;
  }

  if (mimeType.startsWith('image/')) {
    return Icons.media;
  }

  return Icons.page;
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function assertValidUploadFile(file: File) {
  const validationError = getUploadFileValidationError(file);
  if (validationError) {
    throw new Error(validationError);
  }
}

function getUploadFileValidationError(file: File) {
  if (file.size < 1) {
    return 'El archivo está vacío.';
  }

  if (!ACCEPTED_UPLOAD_MIME_TYPES.has(file.type)) {
    return 'Formato no permitido. Subí PDF, JPG, PNG o WebP.';
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return 'El archivo no puede superar 10 MB.';
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
