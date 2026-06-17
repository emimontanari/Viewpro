'use client'

import { toast } from 'sonner'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { normalizePhone, tenantWhatsappPhoneSchema } from '@/features/settings/schemas/tenant-whatsapp-phone'
import { useUpdateTenantWhatsappPhone } from '../api/queries'

type FormValues = {
  whatsappPhone: string | null
}

type TenantContactFormProps = {
  defaultPhone: string | null
}

export function TenantContactForm({ defaultPhone }: TenantContactFormProps) {
  const { FormTextField } = useFormFields<FormValues>()
  const mutation = useUpdateTenantWhatsappPhone()

  const form = useAppForm({
    defaultValues: {
      whatsappPhone: defaultPhone
    } as FormValues,
    validators: {
      onSubmit: tenantWhatsappPhoneSchema
    },
    onSubmit: async ({ value }) => {
      const normalized = normalizePhone(value.whatsappPhone)
      try {
        await mutation.mutateAsync({ whatsappPhone: normalized })
        toast.success('Teléfono actualizado')
      } catch (error) {
        const errorCode =
          error && typeof error === 'object' && 'errorCode' in error
            ? (error as { errorCode: string }).errorCode
            : null
        toast.error(errorCode ? `Error: ${errorCode}` : 'No se pudo actualizar el teléfono.')
      }
    }
  })

  return (
    <form.AppForm>
      <form.Form className='max-w-sm space-y-4'>
        <FormTextField
          name='whatsappPhone'
          label='Teléfono WhatsApp del equipo'
          placeholder='+54 9 351 000 0000'
          type='tel'
        />
        {defaultPhone === null && (
          <p className='text-muted-foreground text-sm'>Aún no hay un número configurado</p>
        )}
        <form.SubmitButton>Guardar</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  )
}
