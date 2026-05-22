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

const INITIAL_EMAIL = '';

type LinkPropertyOwnerDialogProps = {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (email: string) => void;
  open: boolean;
};

export function LinkPropertyOwnerDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open
}: LinkPropertyOwnerDialogProps) {
  const [email, setEmail] = useState(INITIAL_EMAIL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEmail(INITIAL_EMAIL);
      setError(null);
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('El email es obligatorio.');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Ingresá un email válido.');
      return;
    }

    setError(null);
    onSubmit(normalizedEmail);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Vincular propietario</DialogTitle>
          <DialogDescription>
            Usá el email de un usuario existente. Al vincularlo, podrá acceder a esta propiedad.
          </DialogDescription>
        </DialogHeader>

        <form id='link-property-owner-form' className='space-y-5' onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor='property-owner-email'>Email del propietario</FieldLabel>
            <Input
              id='property-owner-email'
              type='email'
              value={email}
              disabled={isSubmitting}
              aria-invalid={!!error}
              autoComplete='email'
              placeholder='propietario@email.com'
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldDescription>Usá el email de un usuario existente.</FieldDescription>
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
