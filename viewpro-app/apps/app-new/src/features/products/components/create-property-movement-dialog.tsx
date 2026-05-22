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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { ProductMovementMutationPayload, PropertyEngagementStatus } from '../api/types';
import { manualMovementTypeOptions } from '../constants/movement-options';
import { propertyStatusOptions } from '../constants/product-options';
import { createProductMovementSchema, type CreateProductMovementValues } from '../schemas/movement';
import { useEffect, useState, type FormEvent } from 'react';
import type { z } from 'zod';

const NO_STATUS_CHANGE = 'NO_STATUS_CHANGE';
const INITIAL_VALUES: CreateProductMovementDialogState = {
  newStatus: NO_STATUS_CHANGE,
  nextStep: '',
  observation: '',
  type: 'GENERAL_UPDATE'
};

type CreateProductMovementDialogState = {
  type: ProductMovementMutationPayload['type'];
  observation: string;
  nextStep: string;
  newStatus: PropertyEngagementStatus | typeof NO_STATUS_CHANGE;
};

type MovementFormErrors = Partial<Record<keyof CreateProductMovementValues, string>>;

export function CreatePropertyMovementDialog({
  isSubmitting,
  onOpenChange,
  onSubmit,
  open
}: {
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: ProductMovementMutationPayload) => void;
  open: boolean;
}) {
  const [values, setValues] = useState<CreateProductMovementDialogState>(INITIAL_VALUES);
  const [errors, setErrors] = useState<MovementFormErrors>({});
  const observationLength = values.observation.length;
  const nextStepLength = values.nextStep.length;

  useEffect(() => {
    if (!open) {
      setValues(INITIAL_VALUES);
      setErrors({});
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = createProductMovementSchema.safeParse({
      newStatus: values.newStatus === NO_STATUS_CHANGE ? undefined : values.newStatus,
      nextStep: values.nextStep,
      observation: values.observation,
      type: values.type
    });

    if (!parsed.success) {
      setErrors(getMovementFormErrors(parsed.error));
      return;
    }

    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Agregar actualización</DialogTitle>
          <DialogDescription>
            Registrá una novedad para que el historial de la propiedad quede al día.
          </DialogDescription>
        </DialogHeader>

        <form id='create-property-movement-form' className='space-y-5' onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor='movement-type'>Tipo de actualización</FieldLabel>
            <Select
              value={values.type}
              disabled={isSubmitting}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  type: value as ProductMovementMutationPayload['type']
                }))
              }
            >
              <SelectTrigger id='movement-type' className='w-full' aria-invalid={!!errors.type}>
                <SelectValue placeholder='Seleccioná un tipo' />
              </SelectTrigger>
              <SelectContent>
                {manualMovementTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errors.type}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor='movement-observation'>Observación</FieldLabel>
            <Textarea
              id='movement-observation'
              value={values.observation}
              maxLength={2000}
              rows={5}
              disabled={isSubmitting}
              aria-invalid={!!errors.observation}
              placeholder='Contá qué pasó, qué se conversó o qué avance hubo.'
              onChange={(event) =>
                setValues((current) => ({ ...current, observation: event.target.value }))
              }
            />
            <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
              <FieldDescription>Visible en el historial interno de la propiedad.</FieldDescription>
              <span>{observationLength} / 2000</span>
            </div>
            <FieldError>{errors.observation}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor='movement-next-step'>Próximo paso</FieldLabel>
            <Textarea
              id='movement-next-step'
              value={values.nextStep}
              maxLength={500}
              rows={3}
              disabled={isSubmitting}
              aria-invalid={!!errors.nextStep}
              placeholder='Opcional: agendar visita, pedir documentación, llamar al propietario.'
              onChange={(event) =>
                setValues((current) => ({ ...current, nextStep: event.target.value }))
              }
            />
            <div className='flex items-center justify-between gap-3 text-xs text-muted-foreground'>
              <FieldDescription>Usalo para dejar clara la siguiente acción.</FieldDescription>
              <span>{nextStepLength} / 500</span>
            </div>
            <FieldError>{errors.nextStep}</FieldError>
          </Field>

          <Field>
            <FieldLabel htmlFor='movement-new-status'>Actualizar estado</FieldLabel>
            <Select
              value={values.newStatus}
              disabled={isSubmitting}
              onValueChange={(value) =>
                setValues((current) => ({
                  ...current,
                  newStatus: value as CreateProductMovementDialogState['newStatus']
                }))
              }
            >
              <SelectTrigger
                id='movement-new-status'
                className='w-full'
                aria-invalid={!!errors.newStatus}
              >
                <SelectValue placeholder='Sin cambio de estado' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_STATUS_CHANGE}>Sin cambio de estado</SelectItem>
                {propertyStatusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>
              Dejalo sin cambio si esta actualización no modifica el estado de la gestión.
            </FieldDescription>
            <FieldError>{errors.newStatus}</FieldError>
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
            form='create-property-movement-form'
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            Guardar actualización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getMovementFormErrors(error: z.ZodError<CreateProductMovementValues>) {
  const fieldErrors = error.flatten().fieldErrors;

  return {
    newStatus: fieldErrors.newStatus?.[0],
    nextStep: fieldErrors.nextStep?.[0],
    observation: fieldErrors.observation?.[0],
    type: fieldErrors.type?.[0]
  } satisfies MovementFormErrors;
}
