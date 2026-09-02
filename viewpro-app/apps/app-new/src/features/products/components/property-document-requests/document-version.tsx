import { Icons, type Icon } from '@/components/icons';
import { useQuery } from '@tanstack/react-query';
import { createProductDocumentReadUrl } from '../../api/service';
import type { ProductDocumentRequest, ProductDocumentVersion } from '../../api/types';
import { getDocumentDisplayName, getVersionMetadata, isImageMimeType } from './model';
import { productKeys } from '../../api/queries';

type DocumentVersionSummaryProps = {
  isReading: boolean;
  onRead: (versionId: string) => void;
  request: ProductDocumentRequest;
  version: ProductDocumentVersion;
};

type DocumentVersionPreviewMediaProps = {
  requestTitle: string;
  version: ProductDocumentVersion;
};

export function DocumentVersionSummary({
  isReading,
  onRead,
  request,
  version
}: DocumentVersionSummaryProps) {
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

export function DocumentVersionPreviewMedia({
  requestTitle,
  version
}: DocumentVersionPreviewMediaProps) {
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
