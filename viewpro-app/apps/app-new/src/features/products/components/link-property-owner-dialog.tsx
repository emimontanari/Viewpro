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
import { useEffect, useState, type FormEvent } from 'react';
import type { LinkProductOwnerPayload } from '../api/types';

const INITIAL_FORM: LinkProductOwnerPayload = {
  firstName: '',
  lastName: '',
  email: ''
};

type LinkPropertyOwnerDialogProps = {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: LinkProductOwnerPayload) => void;
  open: boolean;
};

type FieldErrors = Partial<Record<keyof LinkProductOwnerPayload, string>>;

export function LinkPropertyOwnerDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open
}: LinkPropertyOwnerDialogProps) {
  const [form, setForm] = useState<LinkProductOwnerPayload>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setErrors({});
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase()
    };
    const nextErrors = validateOwnerPayload(payload);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    onSubmit(payload);
  }

  function updateField(field: keyof LinkProductOwnerPayload, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Vincular propietario</DialogTitle>
          <DialogDescription>
            Ingresá los datos del propietario. Vamos a dejarlo vinculado a la propiedad. La
            invitación por email se activará en una próxima etapa.
          </DialogDescription>
        </DialogHeader>

        <form id='link-property-owner-form' className='space-y-5' onSubmit={handleSubmit}>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field>
              <FieldLabel htmlFor='property-owner-first-name'>Nombre</FieldLabel>
              <Input
                id='property-owner-first-name'
                type='text'
                value={form.firstName}
                disabled={isSubmitting}
                aria-invalid={!!errors.firstName}
                autoComplete='given-name'
                placeholder='Nombre'
                onChange={(event) => updateField('firstName', event.target.value)}
              />
              <FieldError>{errors.firstName}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor='property-owner-last-name'>Apellido</FieldLabel>
              <Input
                id='property-owner-last-name'
                type='text'
                value={form.lastName}
                disabled={isSubmitting}
                aria-invalid={!!errors.lastName}
                autoComplete='family-name'
                placeholder='Apellido'
                onChange={(event) => updateField('lastName', event.target.value)}
              />
              <FieldError>{errors.lastName}</FieldError>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor='property-owner-email'>Email</FieldLabel>
            <Input
              id='property-owner-email'
              type='email'
              value={form.email}
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              autoComplete='email'
              placeholder='propietario@email.com'
              onChange={(event) => updateField('email', event.target.value)}
            />
            <FieldDescription>
              No vamos a enviar ningún email todavía; solo quedará vinculado a esta propiedad.
            </FieldDescription>
            <FieldError>{errors.email}</FieldError>
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
            form='link-property-owner-form'
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Vincular propietario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function validateOwnerPayload(payload: LinkProductOwnerPayload) {
  const errors: FieldErrors = {};

  if (!payload.firstName) {
    errors.firstName = 'El nombre es obligatorio.';
  }

  if (!payload.lastName) {
    errors.lastName = 'El apellido es obligatorio.';
  }

  if (!payload.email) {
    errors.email = 'El email es obligatorio.';
  } else if (!isValidEmail(payload.email)) {
    errors.email = 'Ingresá un email válido.';
  }

  return errors;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
