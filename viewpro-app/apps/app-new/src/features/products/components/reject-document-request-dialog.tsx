'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, type FormEvent } from 'react';

const MAX_REJECTION_REASON_LENGTH = 2000;

type RejectDocumentRequestDialogProps = {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => void;
  open: boolean;
  requestTitle?: string;
};

export function RejectDocumentRequestDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  requestTitle
}: RejectDocumentRequestDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const reasonLength = reason.length;

  useEffect(() => {
    if (!open) {
      setReason('');
      setError(null);
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('El motivo de rechazo es obligatorio.');
      return;
    }

    if (trimmedReason.length > MAX_REJECTION_REASON_LENGTH) {
      setError('El motivo no puede superar 2000 caracteres.');
      return;
    }

    setError(null);
    onSubmit(trimmedReason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Rechazar documento</DialogTitle>
          <DialogDescription>
            {requestTitle
              ? `Indicá por qué rechazás “${requestTitle}”. El propietario verá este motivo para corregir la carga.`
              : 'Indicá el motivo para que el propietario pueda corregir la carga.'}
          </DialogDescription>
        </DialogHeader>

        <form id='reject-document-request-form' className='space-y-5' onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor='document-rejection-reason'>Motivo de rechazo</FieldLabel>
            <Textarea
              id='document-rejection-reason'
              value={reason}
              maxLength={MAX_REJECTION_REASON_LENGTH}
              rows={5}
              disabled={isSubmitting}
              aria-invalid={!!error}
              placeholder='Ej: El archivo no corresponde al documento solicitado o falta una página.'
              onChange={(event) => setReason(event.target.value)}
            />
            <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
              <FieldDescription>Este texto será visible para el propietario.</FieldDescription>
              <span>
                {reasonLength} / {MAX_REJECTION_REASON_LENGTH}
              </span>
            </div>
            <FieldError>{error}</FieldError>
          </Field>
        </form>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type='submit'
            form='reject-document-request-form'
            variant='destructive'
            disabled={isSubmitting}
          >
            Rechazar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
