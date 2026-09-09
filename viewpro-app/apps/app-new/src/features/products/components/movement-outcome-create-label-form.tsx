'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useRef } from 'react';
import { createMovementOutcomeLabel } from '../api/service';
import type { MovementOutcomeLabelDto } from '../api/types';
import { movementOutcomeLabelsKeys } from '../api/queries';

type Props = {
  onCreated: (label: MovementOutcomeLabelDto) => void;
  onCancel: () => void;
  onPendingChange: (pending: boolean) => void;
  cancelRef?: React.RefObject<HTMLElement | null>;
};

/**
 * Inline form for creating a custom movement outcome label.
 * Rendered inside MovementOutcomeCombobox when the user clicks "+ Agregar etiqueta".
 *
 * On success: pushes the new label into the TanStack Query cache, then calls onCreated.
 * On collision (idempotent 200): dedupes by id before updating cache.
 * On error: keeps the form open with an error message.
 */
export function MovementOutcomeCreateLabelForm({ onCreated, onCancel, onPendingChange, cancelRef }: Props) {
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);
  const operationRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
    };
  }, []);

  const mutation = useMutation({
    mutationFn: (data: { label: string; color?: string }) => createMovementOutcomeLabel(data)
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const data = new FormData(event.currentTarget);
    const label = (data.get('label') as string | null)?.trim() ?? '';
    const colorRaw = (data.get('color') as string | null)?.trim() ?? '';
    const color = colorRaw || undefined;
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    onPendingChange(true);
    mutation.mutate(
      { label, color },
      {
        onError: () => {
          if (mountedRef.current && operationRef.current === operation) onPendingChange(false);
        },
        onSuccess: (newLabel) => {
          if (!mountedRef.current || operationRef.current !== operation) return;
          const queryKey = movementOutcomeLabelsKeys.list({ activeOnly: true });
          queryClient.setQueryData<MovementOutcomeLabelDto[]>(queryKey, (prev) => {
            const existing = prev ?? [];
            return existing.some((item) => item.id === newLabel.id) ? existing : [...existing, newLabel];
          });
          void queryClient.invalidateQueries({ queryKey: movementOutcomeLabelsKeys.all });
          onCreated(newLabel);
          onPendingChange(false);
        }
      }
    );
  }

  return (
    <form
      className='space-y-3 rounded-lg border bg-muted/30 p-3'
      onSubmit={handleSubmit}
      aria-label='Crear nueva etiqueta'
    >
      <Field>
        <FieldLabel htmlFor='new-label-name'>Nombre</FieldLabel>
        <Input
          id='new-label-name'
          name='label'
          maxLength={40}
          placeholder='Ej: Llamado Cuenta Madre'
          disabled={mutation.isPending}
          aria-required='true'
        />
        <FieldDescription>Máximo 40 caracteres.</FieldDescription>
        {mutation.isError ? (
          <FieldError>{(mutation.error as Error).message}</FieldError>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor='new-label-color'>Color (opcional)</FieldLabel>
        <Input
          id='new-label-color'
          name='color'
          type='text'
          placeholder='#FF5733'
          maxLength={7}
          disabled={mutation.isPending}
          aria-label='Color de la etiqueta en formato hexadecimal'
          aria-describedby='new-label-color-description'
        />
        <FieldDescription id='new-label-color-description'>
          Formato: #RRGGBB (ej: #FF5733)
        </FieldDescription>
      </Field>

      <div className='flex justify-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={mutation.isPending}
          onClick={onCancel}
          ref={cancelRef as React.RefObject<HTMLButtonElement>}
        >
          Cancelar
        </Button>
        <Button type='submit' size='sm' disabled={mutation.isPending} isLoading={mutation.isPending}>
          Crear etiqueta
        </Button>
      </div>
    </form>
  );
}
