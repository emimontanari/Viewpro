'use client';

import { messageFor } from '@/lib/bff-client';
import { Icons, type Icon } from '@/components/icons';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
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
  OwnerDocumentVersion
} from '../api/types';
import { OwnerDocumentStatusBadge, ownerDocumentStatusConfig } from './owner-document-status-badge';
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
const UPLOAD_HELP_TEXT = 'Formatos: JPG, PNG, WebP o PDF · máx. 10 MB.';

type OwnerDocumentActionConfig = {
  primaryReadLabel?: string;
  primaryUploadLabel?: string;
};

type OwnerDocumentLifecycleCopyContext = {
  agencyName: string;
  request: OwnerDocumentRequest;
};

const ownerDocumentLifecycleCopyConfig: Record<
  OwnerDocumentRequestStatus,
  (context: OwnerDocumentLifecycleCopyContext) => string | null
> = {
  APPROVED: ({ request }) =>
    `Aprobado el ${formatUploadDate(request.reviewedAt ?? request.updatedAt)}.`,
  CANCELLED: () => 'Esta solicitud fue cancelada y ya no requiere acciones.',
  PENDING: ({ agencyName }) =>
    `Subí este documento para que ${agencyName} pueda revisar la gestión.`,
  REJECTED: () => null,
  SUBMITTED: ({ agencyName }) =>
    `En revisión por ${agencyName}. Te avisaremos cuando haya una novedad.`
};

const ownerDocumentActionConfig: Record<OwnerDocumentRequestStatus, OwnerDocumentActionConfig> = {
  APPROVED: { primaryReadLabel: 'Abrir documento' },
  CANCELLED: {},
  PENDING: { primaryUploadLabel: 'Subir documento' },
  REJECTED: { primaryUploadLabel: 'Subir nueva versión' },
  // The API currently accepts owner uploads only for PENDING and REJECTED requests.
  // Keep SUBMITTED read-only here instead of showing a replacement action that would fail.
  SUBMITTED: { primaryReadLabel: 'Abrir documento' }
};

type DocumentIcon = Icon;

type OwnerDocumentRequestsProps = {
  /** Agency label shown in card subtitles unless `hideAgencyInDocumentCards` is enabled. */
  agencyName?: string;
  /** Hide repeated agency copy inside each card when the surrounding page already shows it. */
  hideAgencyInDocumentCards?: boolean;
  /** When set, scrolls to and briefly highlights the document request with this id. */
  highlightDocId?: string | null;
  propertyEngagementId: string;
};

type SelectedUpload = {
  file: File;
  requestId: string;
  requestTitle: string;
};

export function OwnerDocumentRequests({
  agencyName = 'la inmobiliaria',
  hideAgencyInDocumentCards = false,
  highlightDocId,
  propertyEngagementId
}: OwnerDocumentRequestsProps) {
  const queryClient = useQueryClient();
  const [selectedUpload, setSelectedUpload] = useState<SelectedUpload | null>(null);
  const [fileSelectionError, setFileSelectionError] = useState<string | null>(null);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<OwnerUploadPhase>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLUListElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const documentRequestsQuery = useQuery(
    ownerDocumentRequestsOptions(propertyEngagementId, OWNER_DOCUMENT_FILTERS)
  );

  // Cleanup timer on unmount to avoid setState-after-unmount.
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  // Scroll to and briefly highlight the target item after the query resolves (D3, FR-F3).
  useEffect(() => {
    if (!highlightDocId || !documentRequestsQuery.isSuccess) {
      return;
    }

    const itemExists = documentRequestsQuery.data.items.some((item) => item.id === highlightDocId);
    if (!itemExists) {
      return;
    }

    const selector = `[data-request-id="${CSS.escape(highlightDocId)}"]`;
    const element = containerRef.current?.querySelector(selector);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightedId(highlightDocId);

    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedId(null);
      highlightTimerRef.current = null;
    }, 2000);
  }, [highlightDocId, documentRequestsQuery.isSuccess, documentRequestsQuery.data]);
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
      const message = messageFor(error, 'No se pudo subir el documento');
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
      toast.error(messageFor(error, 'No se pudo abrir el documento'));
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

      <div className='space-y-3'>
        {fileSelectionError ? (
          <div
            role='alert'
            className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
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
          <ul ref={containerRef} className='space-y-3'>
            {documentRequestsQuery.data?.items.map((request) => (
              <OwnerDocumentRequestItem
                key={request.id}
                agencyName={agencyName}
                isHighlighted={highlightedId === request.id}
                request={request}
                showAgencyInHeader={!hideAgencyInDocumentCards}
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
  isHighlighted,
  isReading,
  isUploading,
  onRead,
  onUpload,
  request,
  showAgencyInHeader
}: {
  agencyName: string;
  isHighlighted: boolean;
  isReading: boolean;
  isUploading: boolean;
  onRead: (versionId: string) => void;
  onUpload: (request: OwnerDocumentRequest, file: File) => void;
  request: OwnerDocumentRequest;
  showAgencyInHeader: boolean;
}) {
  const actionConfig = ownerDocumentActionConfig[request.status];
  const canUpload = Boolean(actionConfig.primaryUploadLabel);
  const canRead = Boolean(actionConfig.primaryReadLabel && request.currentVersion);
  const uploadLabel = actionConfig.primaryUploadLabel ?? 'Subir documento';
  const readLabel = actionConfig.primaryReadLabel ?? 'Abrir documento';
  const currentVersion = request.currentVersion;
  const historicalVersions = getHistoricalVersions(request);
  const hasVersionHistory = historicalVersions.length > 0;
  const lifecycleDescription = getDocumentLifecycleDescription(request, agencyName);
  const requestDescription = getHelpfulRequestDescription(request);
  const agencySubtitle = showAgencyInHeader ? `Solicitado por ${agencyName}` : null;
  // All request cards use one document icon; file previews communicate actual file/category type.
  const HeaderIcon = Icons.post;
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
      className={cn(isHighlighted && 'ring-2 ring-primary rounded-xl')}
      data-request-id={request.id}
    >
      <Card className='overflow-visible py-0 shadow-xs'>
        <CardHeader className='rounded-t-xl border-b bg-muted/10 px-4 py-4'>
          <div
            data-testid='owner-document-card-header'
            className='flex items-start justify-between gap-3'
          >
            <div className='flex min-w-0 items-start gap-3'>
              <span
                aria-hidden='true'
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl border',
                  ownerDocumentStatusConfig[request.status].iconChipClassName
                )}
              >
                <HeaderIcon className='size-5' />
              </span>
              <div className='min-w-0 space-y-1'>
                <h4 className='break-words text-sm font-semibold'>{request.title}</h4>
                {agencySubtitle ? (
                  <p className='truncate text-xs text-muted-foreground' title={agencySubtitle}>
                    {agencySubtitle}
                  </p>
                ) : null}
              </div>
            </div>
            <OwnerDocumentStatusBadge status={request.status} />
          </div>
        </CardHeader>

        <CardContent className='space-y-4 px-4 py-4'>
          {request.status === 'REJECTED' ? <RejectionReasonAlert request={request} /> : null}

          {lifecycleDescription ? (
            <p className='whitespace-pre-wrap break-words text-sm text-foreground/80'>
              {lifecycleDescription}
            </p>
          ) : null}

          {requestDescription ? (
            <div className='rounded-lg border bg-muted/20 p-3'>
              <p className='text-xs font-medium text-foreground'>Qué tiene que incluir</p>
              <p className='mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90'>
                {requestDescription}
              </p>
            </div>
          ) : null}

          {currentVersion ? (
            <DocumentVersionRow
              displayName={getDocumentDisplayName(currentVersion, request.title)}
              metadata={getVersionMetadata(
                currentVersion,
                hasVersionHistory ? historicalVersions.length + 1 : null
              )}
              version={currentVersion}
            />
          ) : null}

          {historicalVersions.length > 0 ? (
            <Accordion
              type='single'
              collapsible
              className='rounded-lg border border-dashed bg-muted/10 px-3'
            >
              <AccordionItem value='document-history' className='border-b-0'>
                <AccordionTrigger className='py-3 text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase hover:no-underline'>
                  Ver historial de versiones ({historicalVersions.length})
                </AccordionTrigger>
                <AccordionContent className='space-y-2 pb-3'>
                  {historicalVersions.map((version, index) => (
                    <DocumentVersionRow
                      key={version.id}
                      displayName={getDocumentDisplayName(version, request.title)}
                      metadata={getVersionMetadata(version, historicalVersions.length - index)}
                      version={version}
                    />
                  ))}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </CardContent>

        {canUpload || canRead ? (
          <CardFooter className='rounded-b-xl border-t bg-muted/10 px-4 py-4'>
            <div className='w-full space-y-2'>
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
                    className='min-h-11 w-full'
                    disabled={isUploading}
                    onClick={handleUploadClick}
                  >
                    <Icons.upload className='size-4' />
                    {uploadLabel}
                  </Button>
                  <p className='text-center text-xs text-muted-foreground'>{UPLOAD_HELP_TEXT}</p>
                </>
              ) : null}

              {canRead ? (
                <Button
                  type='button'
                  className='min-h-11 w-full'
                  disabled={isReading}
                  onClick={() => onRead(request.currentVersion!.id)}
                >
                  <Icons.externalLink className='size-4' />
                  {readLabel}
                </Button>
              ) : null}
            </div>
          </CardFooter>
        ) : null}
      </Card>
    </li>
  );
}

function RejectionReasonAlert({ request }: { request: OwnerDocumentRequest }) {
  const copy = getRejectionCopy(request);

  return (
    <Alert className='border-destructive/30 bg-destructive/10 text-foreground dark:bg-destructive/15'>
      <Icons.warning className='text-destructive' />
      <AlertTitle className='text-destructive'>{copy.title}</AlertTitle>
      <AlertDescription className='text-foreground'>{copy.description}</AlertDescription>
    </Alert>
  );
}

function DocumentVersionRow({
  displayName,
  metadata,
  version
}: {
  /** Optional user-facing filename from the backend; falls back to the original filename. */
  displayName?: string;
  metadata: string;
  version: OwnerDocumentVersion;
}) {
  const fileName = displayName?.trim() || version.originalFilename;

  return (
    <div className='rounded-lg border bg-muted/20 p-3 text-sm'>
      <div className='flex min-w-0 items-center gap-3'>
        <DocumentFilePreview displayName={fileName} version={version} />
        <div className='min-w-0 flex-1'>
          <p className='truncate font-medium text-foreground' title={fileName}>
            {fileName}
          </p>
          <p className='mt-1 text-xs text-foreground/75'>{metadata}</p>
          <p className='mt-1 text-xs text-muted-foreground'>{getFileDetails(version)}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentFilePreview({
  displayName,
  version
}: {
  displayName: string;
  version: OwnerDocumentVersion;
}) {
  const isImage = isImageMimeType(version.mimeType);
  const previewQuery = useQuery({
    enabled: isImage,
    queryKey: [...ownerKeys.all, 'document-version-preview', version.id],
    queryFn: () => createOwnerDocumentReadUrl(version.id),
    retry: false,
    staleTime: 60_000
  });

  if (isImage && previewQuery.data?.readUrl.url) {
    return (
      <div className='size-12 shrink-0 overflow-hidden rounded-lg border bg-muted'>
        {/* oxlint-disable-next-line next/no-img-element -- owner document thumbnails use signed, short-lived document URLs from the authenticated document storage flow. */}
        <img
          src={previewQuery.data.readUrl.url}
          alt={`Vista previa de ${displayName}`}
          className='h-full w-full object-cover'
          loading='lazy'
        />
      </div>
    );
  }

  const FileIcon = getDocumentFileIcon(version.mimeType);

  return (
    <span
      aria-hidden='true'
      className='flex size-12 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground'
    >
      <FileIcon className='size-5' />
    </span>
  );
}

function getRejectionCopy(request: OwnerDocumentRequest) {
  const fallbackTitle = isDniRequest(request.title) ? 'DNI inválido' : 'Documento rechazado';
  const fallbackDescription = isDniRequest(request.title)
    ? 'El archivo no permite validar el DNI del propietario: la imagen debe verse clara, sin recortes ni reflejos.'
    : 'El archivo no cumple con lo solicitado.';
  const reason = request.rejectionReason?.trim();

  if (!reason) {
    return { description: fallbackDescription, title: fallbackTitle };
  }

  const [rawTitle, ...descriptionParts] = reason.split(':');
  const title = normalizeRejectionTitle(rawTitle);
  const description = descriptionParts.join(':').trim();

  if (description) {
    return { description, title: title || fallbackTitle };
  }

  if (isShortRejectionTitle(reason)) {
    return { description: fallbackDescription, title: normalizeRejectionTitle(reason) };
  }

  return { description: reason, title: fallbackTitle };
}

function normalizeRejectionTitle(value: string) {
  const normalized = normalizeSearchText(value);

  if (normalized.includes('dni') && normalized.includes('invalid')) {
    return 'DNI inválido';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function isShortRejectionTitle(value: string) {
  return value.length <= 80 && !/[.!?]/.test(value);
}

function isDniRequest(title: string) {
  const normalizedTitle = normalizeSearchText(title);

  return normalizedTitle.includes('dni') || normalizedTitle.includes('identidad');
}

function isImageMimeType(mimeType: string) {
  return mimeType.startsWith('image/');
}

function formatUploadDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium'
  }).format(new Date(value));
}

function getVersionMetadata(version: OwnerDocumentVersion, versionNumber: number | null) {
  const uploadDate = `Subido el ${formatUploadDate(version.createdAt)}`;

  return versionNumber ? `Versión ${versionNumber} · ${uploadDate}` : uploadDate;
}

function getDocumentDisplayName(version: OwnerDocumentVersion, documentTitle: string) {
  if (isDniRequest(documentTitle)) {
    const fileName = normalizeSearchText(version.originalFilename);

    if (fileName.includes('frente') || fileName.includes('front')) {
      return 'DNI — frente';
    }

    if (fileName.includes('dorso') || fileName.includes('reverso') || fileName.includes('back')) {
      return 'DNI — dorso';
    }
  }

  return normalizeDniCasing(documentTitle.trim() || getReadableFileName(version.originalFilename));
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
  const normalizedName = normalizeSearchText(fileName);

  return normalizedName.includes('seeded') || normalizedName.includes('smoke-document');
}

function getFileDetails(version: OwnerDocumentVersion) {
  return `${getFileFormatLabel(version.mimeType)} · ${formatFileSize(version.sizeBytes)}`;
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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const sizeKb = sizeBytes / 1024;

  if (sizeKb < 1024) {
    return `${formatCompactNumber(sizeKb)} KB`;
  }

  return `${formatCompactNumber(sizeKb / 1024)} MB`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: value >= 10 ? 0 : 1
  }).format(value);
}

function getHistoricalVersions(request: OwnerDocumentRequest) {
  return request.versions
    .filter(
      (version) => version.id !== request.currentVersion?.id && version.status !== 'PENDING_UPLOAD'
    )
    .toSorted((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function getDocumentLifecycleDescription(request: OwnerDocumentRequest, agencyName: string) {
  return ownerDocumentLifecycleCopyConfig[request.status]({ agencyName, request });
}

function getHelpfulRequestDescription(request: OwnerDocumentRequest) {
  const description = request.description?.trim();

  if (!description || normalizeSearchText(description) === normalizeSearchText(request.title)) {
    return null;
  }

  if (isDniRequest(request.title)) {
    return 'Subí el DNI del propietario, frente y dorso en PDF.';
  }

  return normalizeDniCasing(description);
}

function getDocumentFileIcon(mimeType: string): DocumentIcon {
  if (mimeType === 'application/pdf') {
    return Icons.fileTypePdf;
  }

  if (isImageMimeType(mimeType)) {
    return Icons.media;
  }

  return Icons.page;
}

function normalizeDniCasing(value: string) {
  return value.replace(/\bdni\b/gi, 'DNI');
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
