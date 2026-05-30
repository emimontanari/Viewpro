'use client';

import { useFormFields } from '@/components/ui/tanstack-form';
import {
  operationTypeOptions,
  propertyTypeOptions
} from '@/features/products/constants/product-options';
import type { ProductFormValues } from '@/features/products/schemas/product';
import * as z from 'zod';

export function PropertyBasicFields() {
  const { FormTextField, FormSelectField } = useFormFields<ProductFormValues>();

  return (
    <>
      <FormTextField
        name='title'
        label='Título'
        required
        placeholder='Departamento en Palermo'
        validators={{
          onBlur: z.string().min(2, 'El título debe tener al menos 2 caracteres.')
        }}
      />

      <FormSelectField
        name='propertyType'
        label='Tipo de propiedad'
        required
        options={propertyTypeOptions}
        placeholder='Seleccioná un tipo'
      />

      <FormTextField
        name='addressLine'
        label='Dirección'
        required
        placeholder='Av. Santa Fe 1234'
        validators={{
          onBlur: z.string().min(2, 'La dirección es obligatoria.')
        }}
      />

      <FormTextField
        name='city'
        label='Ciudad'
        required
        placeholder='CABA'
        validators={{
          onBlur: z.string().min(2, 'La ciudad es obligatoria.')
        }}
      />

      <FormTextField
        name='province'
        label='Provincia'
        required
        placeholder='Buenos Aires'
        validators={{
          onBlur: z.string().min(2, 'La provincia es obligatoria.')
        }}
      />

      <FormSelectField
        name='operationType'
        label='Operación'
        required
        options={operationTypeOptions}
        placeholder='Seleccioná una operación'
      />
    </>
  );
}

export function PropertyCharacteristicsFields() {
  const { FormTextField } = useFormFields<ProductFormValues>();

  return (
    <div className='md:col-span-2 rounded-xl border bg-muted/20 p-4'>
      <div className='space-y-1'>
        <h3 className='text-sm font-semibold'>Características</h3>
        <p className='text-xs text-muted-foreground'>
          Datos físicos opcionales de la propiedad. Podés completarlos ahora o más adelante.
        </p>
      </div>
      <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <FormTextField
          name='totalAreaSqm'
          label='Superficie total'
          type='number'
          min={0}
          step={1}
          placeholder='360'
          description='m² totales'
        />
        <FormTextField
          name='coveredAreaSqm'
          label='Superficie cubierta'
          type='number'
          min={0}
          step={1}
          placeholder='231'
          description='m² cubiertos'
        />
        <FormTextField
          name='rooms'
          label='Ambientes'
          type='number'
          min={0}
          step={1}
          placeholder='5'
        />
        <FormTextField
          name='bedrooms'
          label='Dormitorios'
          type='number'
          min={0}
          step={1}
          placeholder='3'
        />
        <FormTextField
          name='bathrooms'
          label='Baños'
          type='number'
          min={0}
          step={1}
          placeholder='2'
        />
        <FormTextField
          name='garages'
          label='Cocheras'
          type='number'
          min={0}
          step={1}
          placeholder='1'
        />
        <FormTextField
          name='ageYears'
          label='Antigüedad'
          type='number'
          min={0}
          step={1}
          placeholder='10'
          description='Años'
        />
        <FormTextField
          name='orientation'
          label='Orientación'
          placeholder='NE'
          validators={{
            onBlur: z.string().max(16, 'La orientación no puede superar 16 caracteres.')
          }}
        />
      </div>
    </div>
  );
}

export function PropertyOwnerReferenceFields() {
  const { FormTextField } = useFormFields<ProductFormValues>();

  return (
    <>
      <FormTextField name='ownerName' label='Propietario' placeholder='Nombre del propietario' />

      <FormTextField
        name='ownerEmail'
        label='Email del propietario'
        type='email'
        placeholder='propietario@email.com'
      />
    </>
  );
}
