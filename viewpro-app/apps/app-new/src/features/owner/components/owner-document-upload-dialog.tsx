'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

export type OwnerUploadPhase = 'idle' | 'preparing' | 'uploading' | 'confirming';

export type OwnerDocumentUploadDialogProps = {
  errorMessage: string | null;
  file: File | null;
  isUploading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  progress: number;
  requestTitle?: string;
  uploadPhase: OwnerUploadPhase;
};

export function OwnerDocumentUploadDialog({
  errorMessage,
  file,
  isUploading,
  onCancel,
  onConfirm,
  open,
  progress,
  requestTitle,
  uploadPhase
}: OwnerDocumentUploadDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file ? file.type.startsWith('image/') : false;
  const statusLabel = getUploadStatusLabel(uploadPhase);
  const progressValue = getProgressValue(uploadPhase, progress);

  useEffect(() => {
    if (!file || !isImage || typeof URL === 'undefined' || !URL.createObjectURL) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [file, isImage]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && !isUploading) {
      onCancel();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Confirmar carga de documento</DialogTitle>
          <DialogDescription>
            Revisá el archivo antes de enviarlo a la inmobiliaria.
          </DialogDescription>
        </DialogHeader>

        {file ? (
          <div className='space-y-4'>
            <div className='rounded-2xl border bg-muted/20 p-3'>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                Solicitud
              </p>
              <p className='mt-1 break-words text-sm font-semibold'>
                {requestTitle ?? 'Documento solicitado'}
              </p>
            </div>

            {isImage && previewUrl ? (
              <div className='overflow-hidden rounded-2xl border bg-muted/20'>
                <img
                  src={previewUrl}
                  alt={`Vista previa de ${file.name}`}
                  className='max-h-72 w-full object-contain'
                />
              </div>
            ) : (
              <Card className='shadow-none'>
                <CardContent className='flex items-start gap-3 px-4 py-4'>
                  <div className='rounded-xl bg-red-50 p-2 text-red-600 dark:bg-red-950/40 dark:text-red-300'>
                    {file.type === 'application/pdf' ? (
                      <Icons.fileTypePdf className='size-6' />
                    ) : (
                      <Icons.page className='size-6' />
                    )}
                  </div>
                  <div className='min-w-0 flex-1 space-y-1'>
                    <p className='break-words text-sm font-semibold'>{file.name}</p>
                    <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                      <Badge variant='outline'>{formatFileSize(file.size)}</Badge>
                      <Badge variant='outline'>{file.type || 'Tipo desconocido'}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isImage && previewUrl ? (
              <div className='flex flex-wrap gap-2 text-xs text-muted-foreground'>
                <Badge variant='outline'>{file.name}</Badge>
                <Badge variant='outline'>{formatFileSize(file.size)}</Badge>
                <Badge variant='outline'>{file.type}</Badge>
              </div>
            ) : null}

            <p className='rounded-xl border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground'>
              Formatos aceptados: PDF, JPG, PNG o WebP. Tamaño máximo: 10 MB.
            </p>

            {errorMessage ? (
              <div
                role='alert'
                className='rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300'
              >
                {errorMessage}
              </div>
            ) : null}

            {isUploading ? (
              <div className='space-y-2 rounded-xl border bg-background p-3'>
                <div className='flex items-center justify-between gap-3 text-sm'>
                  <span className='font-medium'>{statusLabel}</span>
                  <span className='text-muted-foreground'>{progressValue}%</span>
                </div>
                <Progress value={progressValue} />
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type='button' variant='outline' disabled={isUploading} onClick={onCancel}>
            Cancelar
          </Button>
          <Button type='button' disabled={isUploading || !file} onClick={onConfirm}>
            {isUploading ? (
              <Icons.spinner className='size-4 animate-spin' />
            ) : (
              <Icons.upload className='size-4' />
            )}
            Confirmar carga
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const sizeKb = sizeBytes / 1024;
  if (sizeKb < 1024) {
    return `${formatDecimal(sizeKb)} KB`;
  }

  return `${formatDecimal(sizeKb / 1024)} MB`;
}

function formatDecimal(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function getUploadStatusLabel(uploadPhase: OwnerUploadPhase) {
  const labels: Record<OwnerUploadPhase, string> = {
    confirming: 'Confirmando carga',
    idle: 'Listo para subir',
    preparing: 'Preparando enlace seguro',
    uploading: 'Subiendo archivo'
  };

  return labels[uploadPhase];
}

function getProgressValue(uploadPhase: OwnerUploadPhase, progress: number) {
  if (uploadPhase === 'preparing') {
    return 10;
  }

  if (uploadPhase === 'uploading') {
    return Math.max(35, Math.min(85, progress));
  }

  if (uploadPhase === 'confirming') {
    return 90;
  }

  return 0;
}
