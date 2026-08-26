'use client'

import { toast } from 'sonner'
import type { PublicErrorCode } from '@viewpro/contracts'
import { useAppForm, useFormFields } from '@/components/ui/tanstack-form'
import { normalizePhone, tenantWhatsappPhoneSchema } from '@/features/settings/schemas/tenant-whatsapp-phone'
import { useUpdateTenantWhatsappPhone } from '../api/queries'

type FormValues = {
  whatsappPhone: string | null
}

type TenantContactFormProps = {
  defaultPhone: string | null
}

// The client never parses or validates phone shape/country — only presence.
// Validity and the AR-only rule are decided exclusively by the server, which
// answers with one of these three codes, the same ones registration uses
// (design.md ADR-2, ADR-6).
const PHONE_ERROR_MESSAGES: Partial<Record<PublicErrorCode, string>> = {
  'phone.required': 'Ingresá el teléfono de contacto de la inmobiliaria.',
  'phone.invalid': 'Ese teléfono no es válido. Revisá el número e intentá de nuevo.',
  'phone.country_unsupported': 'Por ahora solo aceptamos teléfonos de Argentina.'
}

function getPhoneErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('errorCode' in error)) {
    return null
  }
  const { errorCode } = error as { errorCode: string | null }
  return errorCode ? (PHONE_ERROR_MESSAGES[errorCode as PublicErrorCode] ?? null) : null
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
      // Trimmed raw value only — no local reshaping. The server's
      // parseArContactPhone output (canonical E.164) is the only
      // canonical form (design.md ADR-6).
      const normalized = normalizePhone(value.whatsappPhone)
      try {
        await mutation.mutateAsync({ whatsappPhone: normalized })
        toast.success('Teléfono actualizado')
      } catch (error) {
        toast.error(getPhoneErrorMessage(error) ?? 'No se pudo actualizar el teléfono.')
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
