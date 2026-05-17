'use client'

import { type FormEvent, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/api-client'
import { createDocumentRequest, type DocumentRequest } from '@/lib/documents'

type RequestDocumentFormProps = {
  ownerEmail?: string | null
  propertyEngagementId: string
  tenantId: string
  onCreated: (request: DocumentRequest) => Promise<void> | void
}

type FormState = {
  error: string | null
  isSubmitting: boolean
  successTitle: string | null
}

export function RequestDocumentForm({ ownerEmail, propertyEngagementId, tenantId, onCreated }: RequestDocumentFormProps) {
  const [state, setState] = useState<FormState>({ error: null, isSubmitting: false, successTitle: null })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    const ownerUserId = getRequiredValue(formData, 'ownerUserId')
    const title = getRequiredValue(formData, 'title')
    const description = getRequiredValue(formData, 'description')

    if (!ownerUserId || !title) {
      setState((current) => ({ ...current, error: 'Completá el propietario y el documento solicitado.' }))
      return
    }

    setState((current) => ({ ...current, error: null, isSubmitting: true }))

    try {
      const request = await createDocumentRequest({
        description: description || undefined,
        ownerUserId,
        propertyEngagementId,
        tenantId,
        title,
      })

      form.reset()
      setState({ error: null, isSubmitting: false, successTitle: request.title })
      await onCreated(request)
    } catch (caughtError) {
      setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), isSubmitting: false }))
    }
  }

  return (
    <Card className="document-form-card">
      <CardHeader>
        <p className="engagement-workspace__eyebrow">Solicitar documento</p>
        <h2>Nuevo pedido</h2>
        <p>Creá una solicitud real para un propietario activo de esta propiedad.</p>
      </CardHeader>
      <CardContent>
        <form className="document-form" onSubmit={handleSubmit}>
          <Input
            id="ownerUserId"
            label="ID de usuario propietario"
            name="ownerUserId"
            placeholder="UUID del propietario activo"
            required
            hint={ownerEmail ? `Referencia visible en la gestión: ${ownerEmail}` : 'El backend requiere el userId del propietario activo.'}
          />
          <Input
            id="title"
            label="Documento solicitado"
            maxLength={200}
            name="title"
            placeholder="Ej: Escritura, DNI, plano municipal"
            required
          />
          <div className="vp-input-wrap">
            <label className="vp-label" htmlFor="description">
              Detalle para el propietario
            </label>
            <textarea
              className="vp-input document-form__textarea"
              id="description"
              maxLength={2000}
              name="description"
              placeholder="Explicá qué archivo necesitás y cualquier condición de revisión."
              rows={4}
            />
          </div>

          {state.error ? <p className="auth-form__error">{state.error}</p> : null}
          {state.successTitle ? (
            <p className="document-form__success" role="status">
              Solicitud creada: {state.successTitle}.
            </p>
          ) : null}

          <Button disabled={state.isSubmitting} type="submit">
            {state.isSubmitting ? 'Creando solicitud…' : 'Crear solicitud'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
