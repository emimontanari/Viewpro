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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { CreateProductDocumentRequestPayload, PropertyLinkedOwner } from '../api/types';
import { useEffect, useState, type FormEvent } from 'react';

const INITIAL_VALUES = {
  description: '',
  ownerUserId: '',
  title: ''
};

type CreateDocumentRequestDialogValues = typeof INITIAL_VALUES;
type CreateDocumentRequestDialogErrors = Partial<
  Record<keyof CreateDocumentRequestDialogValues, string>
>;

type CreateDocumentRequestDialogProps = {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateProductDocumentRequestPayload) => void;
  open: boolean;
  owners: PropertyLinkedOwner[];
};

export function CreateDocumentRequestDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open,
  owners
}: CreateDocumentRequestDialogProps) {
  const [values, setValues] = useState<CreateDocumentRequestDialogValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<CreateDocumentRequestDialogErrors>({});
  const titleLength = values.title.length;
  const descriptionLength = values.description.length;

  useEffect(() => {
    if (!open) {
      setValues(INITIAL_VALUES);
      setErrors({});
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateDocumentRequest(values);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onSubmit({
      ownerUserId: values.ownerUserId,
      title: values.title.trim(),
      description: values.description.trim() || undefined
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Solicitar documento</DialogTitle>
          <DialogDescription>
            Elegí el propietario y detallá qué documentación necesitás.
          </DialogDescription>
        </DialogHeader>

        <form id='create-document-request-form' className='space-y-5' onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor='document-owner'>Propietario</FieldLabel>
            <Select
              value={values.ownerUserId}
              disabled={isSubmitting || owners.length === 0}
              onValueChange={(value) =>
                setValues((current) => ({ ...current, ownerUserId: value }))
              }
            >
              <SelectTrigger
                id='document-owner'
                className='w-full'
                aria-invalid={!!errors.ownerUserId}
              >
                <SelectValue placeholder='Seleccioná un propietario' />
              </SelectTrigger>
              <SelectContent>
                {owners.map((owner) => (
                  <SelectItem key={owner.userId} value={owner.userId}>
                    {getOwnerDisplayName(owner)} · {owner.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>La solicitud quedará asociada a este propietario.</FieldDescription>
            <FieldError>{errors.ownerUserId}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor='document-title'>Documento solicitado</FieldLabel>
            <Input
              id='document-title'
              value={values.title}
              maxLength={160}
              disabled={isSubmitting}
              aria-invalid={!!errors.title}
              placeholder='Ej: Escritura, DNI, comprobante de servicios'
              onChange={(event) =>
                setValues((current) => ({ ...current, title: event.target.value }))
              }
            />
            <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
              <FieldDescription>Usá un título claro para el propietario.</FieldDescription>
              <span>{titleLength} / 160</span>
            </div>
            <FieldError>{errors.title}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor='document-description'>Detalle opcional</FieldLabel>
            <Textarea
              id='document-description'
              value={values.description}
              maxLength={1000}
              rows={4}
              disabled={isSubmitting}
              aria-invalid={!!errors.description}
              placeholder='Agregá indicaciones, formato esperado o aclaraciones importantes.'
              onChange={(event) =>
                setValues((current) => ({ ...current, description: event.target.value }))
              }
            />
            <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
              <FieldDescription>Ayuda a evitar idas y vueltas con el propietario.</FieldDescription>
              <span>{descriptionLength} / 1000</span>
            </div>
            <FieldError>{errors.description}</FieldError>
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
            form='create-document-request-form'
            disabled={isSubmitting || owners.length === 0}
            isLoading={isSubmitting}
          >
            Solicitar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validateDocumentRequest(values: CreateDocumentRequestDialogValues) {
  const errors: CreateDocumentRequestDialogErrors = {};
  const title = values.title.trim();
  const description = values.description.trim();

  if (!values.ownerUserId) {
    errors.ownerUserId = 'Seleccioná un propietario.';
  }

  if (!title) {
    errors.title = 'El documento solicitado es obligatorio.';
  } else if (title.length > 160) {
    errors.title = 'El título no puede superar 160 caracteres.';
  }

  if (description.length > 1000) {
    errors.description = 'El detalle no puede superar 1000 caracteres.';
  }

  return errors;
}

function getOwnerDisplayName(owner: { email: string; firstName: string | null }) {
  return owner.firstName?.trim() || owner.email;
}
