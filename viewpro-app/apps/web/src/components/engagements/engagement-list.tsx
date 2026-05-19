'use client'

import { useEffect, useState } from 'react'

import { EngagementSummaryCard } from '@/components/engagements/engagement-summary-card'
import { InternalShell } from '@/components/layout/internal-shell'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { listEngagements, type PropertyEngagement } from '@/lib/engagements'
import { getSession, type TenantMembership } from '@/lib/session'
import { getSelectedTenantId } from '@/lib/tenant-selection'

type EngagementListState = {
  engagements: PropertyEngagement[]
  error: string | null
  isLoading: boolean
  selectedMembership: TenantMembership | null
  selectedTenantId: string | null
  total: number
}

const initialState: EngagementListState = {
  engagements: [],
  error: null,
  isLoading: true,
  selectedMembership: null,
  selectedTenantId: null,
  total: 0,
}

export function EngagementList() {
  const [state, setState] = useState<EngagementListState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadEngagements() {
      const tenantId = getSelectedTenantId()
      if (!tenantId) {
        setState((current) => ({ ...current, isLoading: false, selectedTenantId: null }))
        return
      }

      try {
        const [session, response] = await Promise.all([
          getSession(),
          listEngagements({ page: 1, pageSize: 20, tenantId }),
        ])

        if (!isMounted) {
          return
        }

        setState({
          engagements: response.items,
          error: null,
          isLoading: false,
          selectedMembership: session.memberships.find((membership) => membership.tenant.id === tenantId) ?? null,
          selectedTenantId: tenantId,
          total: response.total,
        })
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

    loadEngagements()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <InternalShell
      description="Abrí, revisá y creá gestiones reales para la inmobiliaria elegida. Sin datos inventados: si todavía no hay operaciones, empezá por crear la primera."
      selectedTenantName={state.selectedMembership?.tenant.name}
      title="Gestiones"
    >
      {state.isLoading ? <p className="workspace-note">Cargando gestiones de la inmobiliaria…</p> : null}
      {!state.isLoading && !state.selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir inmobiliaria</ButtonLink>}
          description="Elegí una inmobiliaria antes de abrir sus gestiones, propiedades, propietarios y documentos."
          title="Elegí una inmobiliaria para ver gestiones"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && state.error ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Revisar inmobiliaria</ButtonLink>}
          description={state.error}
          title="No pudimos cargar las gestiones"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && !state.error ? (
        <section className="engagement-workspace" aria-label="Listado de gestiones">
          <Card className="engagement-workspace__intro" tone="subtle">
            <CardContent className="engagement-workspace__intro-content">
              <div>
                <p className="engagement-workspace__eyebrow">Operación comercial</p>
                <h2>{state.total === 1 ? '1 gestión activa en el radar' : `${state.total} gestiones en el radar`}</h2>
                <p>Usá este listado para entrar al detalle de cada propiedad o cargar una nueva gestión.</p>
              </div>
              <ButtonLink href="/engagements/new">Crear gestión</ButtonLink>
            </CardContent>
          </Card>

          {state.engagements.length > 0 ? (
            <div className="engagement-list">
              {state.engagements.map((engagement) => (
                <EngagementSummaryCard engagement={engagement} key={engagement.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              action={<ButtonLink href="/engagements/new">Crear primera gestión</ButtonLink>}
              description="Todavía no hay propiedades cargadas para esta inmobiliaria. Creá una gestión para empezar a registrar el avance real de una operación."
              title="No hay gestiones creadas"
            />
          )}
        </section>
      ) : null}
    </InternalShell>
  )
}
