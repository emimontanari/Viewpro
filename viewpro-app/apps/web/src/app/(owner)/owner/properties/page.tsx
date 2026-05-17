'use client'

import { useEffect, useState } from 'react'

import { OwnerShell } from '@/components/layout/owner-shell'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { listOwnerProperties, type OwnerProperty, type OwnerPropertyType } from '@/lib/owner-portal'

type OwnerPropertiesState = {
  error: string | null
  isLoading: boolean
  properties: OwnerProperty[]
}

const initialState: OwnerPropertiesState = {
  error: null,
  isLoading: true,
  properties: [],
}

const propertyTypeLabels: Record<OwnerPropertyType, string> = {
  APARTMENT: 'Departamento',
  COMMERCIAL: 'Comercial',
  HOUSE: 'Casa',
  LAND: 'Terreno',
  OTHER: 'Otra propiedad',
}

export default function OwnerPropertiesPage() {
  const [state, setState] = useState<OwnerPropertiesState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadProperties() {
      try {
        const properties = await listOwnerProperties()

        if (!isMounted) {
          return
        }

        setState({ error: null, isLoading: false, properties })
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        setState({ error: getApiErrorMessage(caughtError), isLoading: false, properties: [] })
      }
    }

    loadProperties()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <OwnerShell
      description="Seguí el estado real de tus propiedades, las gestiones activas y las novedades publicadas por el equipo."
      title="Mis propiedades"
    >
      {state.isLoading ? <p className="owner-note">Cargando tus propiedades…</p> : null}
      {!state.isLoading && state.error ? (
        <EmptyState description={state.error} title="No pudimos cargar tus propiedades" />
      ) : null}
      {!state.isLoading && !state.error ? (
        <section className="owner-workspace" aria-label="Listado de propiedades del propietario">
          <Card tone="subtle" className="owner-workspace__intro">
            <CardContent className="owner-workspace__intro-content">
              <div>
                <p className="owner-workspace__eyebrow">Resumen</p>
                <h2>{formatPropertyTotal(state.properties.length)}</h2>
                <p>Mostramos únicamente propiedades asociadas a tu usuario autenticado.</p>
              </div>
            </CardContent>
          </Card>

          {state.properties.length > 0 ? (
            <div className="owner-property-list">
              {state.properties.map((property) => (
                <Card tone="subtle" className="owner-property-card" key={property.id}>
                  <CardContent className="owner-property-card__content">
                    <div className="owner-property-card__topline">
                      <Badge tone="teal">{propertyTypeLabels[property.propertyType]}</Badge>
                      <span>Actualizada {formatDate(property.updatedAt)}</span>
                    </div>
                    <div>
                      <h2>{property.title}</h2>
                      <p>{property.addressLine}</p>
                      <p>{property.city}, {property.province}</p>
                    </div>
                    <div className="owner-property-card__footer">
                      <span>Alta {formatDate(property.createdAt)}</span>
                      <ButtonLink href={`/owner/properties/${property.id}`} size="sm" variant="secondary">
                        Ver detalle
                      </ButtonLink>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Cuando una inmobiliaria te habilite acceso, vas a ver acá tus propiedades reales. No mostramos datos de ejemplo."
              title="Todavía no tenés propiedades visibles"
            />
          )}
        </section>
      ) : null}
    </OwnerShell>
  )
}

function formatPropertyTotal(total: number) {
  if (total === 0) {
    return 'Sin propiedades visibles por ahora'
  }

  return total === 1 ? '1 propiedad visible' : `${total} propiedades visibles`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
