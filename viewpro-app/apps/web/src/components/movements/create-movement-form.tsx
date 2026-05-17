'use client'

import { type FormEvent, type ReactNode, useState } from 'react'

import { formatEngagementStatus } from '@/components/engagements/engagement-summary-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/api-client'
import type { PropertyEngagementStatus } from '@/lib/engagements'
import { createMovement, type Movement, type MovementType } from '@/lib/movements'

type CreateMovementFormProps = {
  currentStatus: PropertyEngagementStatus
  propertyEngagementId: string
  tenantId: string
  onCreated: (movement: Movement) => Promise<void> | void
}

type FormState = {
  error: string | null
  isSubmitting: boolean
  latestMovement: Movement | null
}

const statusOptions: PropertyEngagementStatus[] = [
  'CAPTURE',
  'DOCUMENTATION_PENDING',
  'PUBLICATION_PREPARATION',
  'ACTIVE_PUBLICATION',
  'INQUIRIES_AND_VISITS',
  'OFFER_NEGOTIATION',
  'RESERVATION_STARTED',
  'FINAL_DOCUMENTATION',
  'CLOSED',
  'CANCELLED',
]

export function CreateMovementForm({ currentStatus, propertyEngagementId, tenantId, onCreated }: CreateMovementFormProps) {
  const [state, setState] = useState<FormState>({ error: null, isSubmitting: false, latestMovement: null })

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)
    const type = getRequiredValue(formData, 'type') as MovementType
    const observation = getRequiredValue(formData, 'observation')

    if (!observation) {
      setState((current) => ({ ...current, error: 'Escribí un update breve antes de publicar.' }))
      return
    }

    setState((current) => ({ ...current, error: null, isSubmitting: true }))

    try {
      const movement = await createMovement({
        newStatus: getOptionalStatus(formData),
        nextStep: getOptionalValue(formData, 'nextStep'),
        observation,
        propertyEngagementId,
        tenantId,
        type,
      })

      form.reset()
      setState({ error: null, isSubmitting: false, latestMovement: movement })

      try {
        await onCreated(movement)
      } catch (caughtError) {
        setState({
          error: `Movimiento publicado, pero no pudimos refrescar el timeline: ${getApiErrorMessage(caughtError)}`,
          isSubmitting: false,
          latestMovement: movement,
        })
      }
    } catch (caughtError) {
      setState((current) => ({
        ...current,
        error: getApiErrorMessage(caughtError),
        isSubmitting: false,
      }))
    }
  }

  return (
    <Card className="movement-form-card">
      <CardHeader>
        <p className="engagement-workspace__eyebrow">Publicar movimiento</p>
        <h2>Nuevo update</h2>
        <p>Registrá un avance real, un próximo paso y, si corresponde, actualizá el estado de la gestión.</p>
      </CardHeader>
      <CardContent>
        <form className="movement-form" onSubmit={handleSubmit}>
          <SelectField id="type" label="Tipo" name="type" required>
            <option value="GENERAL_UPDATE">Actualización general</option>
            <option value="INQUIRY">Consulta</option>
            <option value="VISIT_SCHEDULED">Visita agendada</option>
            <option value="VISIT_COMPLETED">Visita realizada</option>
            <option value="OFFER_RECEIVED">Oferta recibida</option>
            <option value="DOCUMENTATION_UPDATE">Documentación</option>
            <option value="STATUS_CHANGE">Cambio de estado</option>
          </SelectField>

          <div className="vp-input-wrap">
            <label className="vp-label" htmlFor="observation">
              Update breve
            </label>
            <textarea
              className="vp-input movement-form__textarea"
              id="observation"
              maxLength={2000}
              name="observation"
              placeholder="Ej: Se coordinó visita con comprador interesado para el jueves."
              required
              rows={5}
            />
          </div>

          <Input id="nextStep" label="Próximo paso" maxLength={500} name="nextStep" />

          <SelectField hint={`Estado actual: ${formatEngagementStatus(currentStatus)}`} id="newStatus" label="Cambiar estado" name="newStatus">
            <option value="">Mantener estado actual</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatEngagementStatus(status)}
              </option>
            ))}
          </SelectField>

          {state.error ? <p className="auth-form__error">{state.error}</p> : null}
          {state.latestMovement ? (
            <p className="movement-form__success" role="status">
              Movimiento publicado. Último update: {state.latestMovement.observation}
            </p>
          ) : null}

          <Button disabled={state.isSubmitting} type="submit">
            {state.isSubmitting ? 'Publicando movimiento…' : 'Publicar movimiento'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type SelectFieldProps = {
  children: ReactNode
  hint?: ReactNode
  id: string
  label: string
  name: string
  required?: boolean
}

function SelectField({ children, hint, id, label, name, required }: SelectFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined

  return (
    <div className="vp-input-wrap">
      <label className="vp-label" htmlFor={id}>
        {label}
      </label>
      <select aria-describedby={hintId} className="vp-input" id={id} name={name} required={required}>
        {children}
      </select>
      {hint ? (
        <p className="vp-field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function getOptionalValue(formData: FormData, key: string) {
  const value = getRequiredValue(formData, key)
  return value || undefined
}

function getOptionalStatus(formData: FormData) {
  return getOptionalValue(formData, 'newStatus') as PropertyEngagementStatus | undefined
}
