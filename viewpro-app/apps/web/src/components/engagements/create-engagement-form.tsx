'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { InternalShell } from '@/components/layout/internal-shell'
import { Button, ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage } from '@/lib/api-client'
import { createEngagement, type PropertyOperationType, type PropertyType } from '@/lib/engagements'
import { getSession, type TenantMembership } from '@/lib/session'
import { getSelectedTenantId } from '@/lib/tenant-selection'

type FormState = {
  error: string | null
  isLoading: boolean
  isSubmitting: boolean
  selectedMembership: TenantMembership | null
  selectedTenantId: string | null
}

const initialState: FormState = {
  error: null,
  isLoading: true,
  isSubmitting: false,
  selectedMembership: null,
  selectedTenantId: null,
}

export function CreateEngagementForm() {
  const router = useRouter()
  const [state, setState] = useState<FormState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadTenantContext() {
      const tenantId = getSelectedTenantId()
      if (!tenantId) {
        setState((current) => ({ ...current, isLoading: false, selectedTenantId: null }))
        return
      }

      try {
        const session = await getSession()
        if (!isMounted) {
          return
        }

        setState((current) => ({
          ...current,
          error: null,
          isLoading: false,
          selectedMembership: session.memberships.find((membership) => membership.tenant.id === tenantId) ?? null,
          selectedTenantId: tenantId,
        }))
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        setState((current) => ({
          ...current,
          error: getApiErrorMessage(caughtError),
          isLoading: false,
          selectedTenantId: tenantId,
        }))
      }
    }

    loadTenantContext()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!state.selectedTenantId) {
      return
    }

    const formData = new FormData(event.currentTarget)
    setState((current) => ({ ...current, error: null, isSubmitting: true }))

    try {
      const created = await createEngagement({
        addressLine: getRequiredValue(formData, 'addressLine'),
        city: getRequiredValue(formData, 'city'),
        currency: getOptionalValue(formData, 'currency')?.toUpperCase(),
        operationType: getRequiredValue(formData, 'operationType') as PropertyOperationType,
        ownerEmail: getOptionalValue(formData, 'ownerEmail'),
        ownerName: getOptionalValue(formData, 'ownerName'),
        propertyType: getRequiredValue(formData, 'propertyType') as PropertyType,
        province: getRequiredValue(formData, 'province'),
        publishedPriceCents: parsePriceCents(getOptionalValue(formData, 'publishedPrice')),
        tenantId: state.selectedTenantId,
        title: getRequiredValue(formData, 'title'),
      })

      router.push(`/engagements/${created.id}`)
    } catch (caughtError) {
      setState((current) => ({
        ...current,
        error: getApiErrorMessage(caughtError),
        isSubmitting: false,
      }))
    }
  }

  return (
    <InternalShell
      description="Cargá los datos mínimos que el backend necesita para crear el activo de propiedad y su gestión tenant-scoped."
      selectedTenantName={state.selectedMembership?.tenant.name}
      title="Crear gestión"
    >
      {state.isLoading ? <p className="workspace-note">Preparando formulario…</p> : null}
      {!state.isLoading && !state.selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Seleccionar tenant</ButtonLink>}
          description="Elegí una inmobiliaria antes de crear una gestión. La operación se guarda siempre dentro del tenant seleccionado."
          title="Seleccioná un tenant para crear gestiones"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && state.error && !state.selectedMembership ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Revisar tenant</ButtonLink>}
          description={state.error}
          title="No pudimos validar tu tenant"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && state.selectedMembership ? (
        <Card className="engagement-form-card">
          <CardContent>
            <form className="engagement-form" onSubmit={handleSubmit}>
              <div className="engagement-form__section">
                <div>
                  <p className="engagement-workspace__eyebrow">Propiedad</p>
                  <h2>Datos principales</h2>
                </div>
                <div className="engagement-form__grid">
                  <Input id="title" label="Título" maxLength={120} name="title" required />
                  <Input id="addressLine" label="Dirección" maxLength={180} name="addressLine" required />
                  <Input id="city" label="Ciudad" maxLength={80} name="city" required />
                  <Input id="province" label="Provincia" maxLength={80} name="province" required />
                  <SelectField id="propertyType" label="Tipo de propiedad" name="propertyType" required>
                    <option value="HOUSE">Casa</option>
                    <option value="APARTMENT">Departamento</option>
                    <option value="LAND">Terreno</option>
                    <option value="COMMERCIAL">Comercial</option>
                    <option value="OTHER">Otra</option>
                  </SelectField>
                  <SelectField id="operationType" label="Operación" name="operationType" required>
                    <option value="SALE">Venta</option>
                    <option value="RENT">Alquiler</option>
                  </SelectField>
                </div>
              </div>

              <div className="engagement-form__section">
                <div>
                  <p className="engagement-workspace__eyebrow">Propietario y precio</p>
                  <h2>Información opcional</h2>
                </div>
                <div className="engagement-form__grid">
                  <Input id="ownerName" label="Nombre del propietario" maxLength={120} name="ownerName" />
                  <Input id="ownerEmail" label="Email del propietario" name="ownerEmail" type="email" />
                  <Input
                    hint="Ingresá el monto sin separadores; ViewPro lo enviará al backend en centavos."
                    id="publishedPrice"
                    label="Precio publicado"
                    min="0"
                    name="publishedPrice"
                    step="0.01"
                    type="number"
                  />
                  <Input id="currency" label="Moneda" maxLength={3} name="currency" placeholder="USD" />
                </div>
              </div>

              {state.error ? <p className="auth-form__error">{state.error}</p> : null}

              <div className="engagement-form__actions">
                <Button disabled={state.isSubmitting} type="submit">
                  {state.isSubmitting ? 'Creando gestión…' : 'Crear gestión'}
                </Button>
                <ButtonLink href="/engagements" variant="secondary">
                  Cancelar
                </ButtonLink>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </InternalShell>
  )
}

type SelectFieldProps = {
  children: ReactNode
  id: string
  label: string
  name: string
  required?: boolean
}

function SelectField({ children, id, label, name, required }: SelectFieldProps) {
  return (
    <div className="vp-input-wrap">
      <label className="vp-label" htmlFor={id}>
        {label}
      </label>
      <select className="vp-input" id={id} name={name} required={required}>
        {children}
      </select>
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

function parsePriceCents(value?: string) {
  if (!value) {
    return undefined
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : undefined
}
