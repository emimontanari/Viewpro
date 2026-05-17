'use client'

import { useEffect, useState } from 'react'

import { EventAuditTable } from '@/components/analytics/event-audit-table'
import { InactiveEngagementsPanel } from '@/components/analytics/inactive-engagements-panel'
import { PilotSummaryPanel } from '@/components/analytics/pilot-summary-panel'
import { InternalShell } from '@/components/layout/internal-shell'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { getAnalyticsDashboardData, listAnalyticsEvents, type AnalyticsDashboardData, type AnalyticsEventName } from '@/lib/analytics'
import { getSession, type TenantMembership } from '@/lib/session'
import { getSelectedTenantId } from '@/lib/tenant-selection'

type AnalyticsPageState = {
  data: AnalyticsDashboardData | null
  error: string | null
  eventName: AnalyticsEventName | ''
  isLoading: boolean
  isRefreshingEvents: boolean
  selectedMembership: TenantMembership | null
  selectedTenantId: string | null
}

const initialState: AnalyticsPageState = {
  data: null,
  error: null,
  eventName: '',
  isLoading: true,
  isRefreshingEvents: false,
  selectedMembership: null,
  selectedTenantId: null,
}

export default function AnalyticsPage() {
  const [state, setState] = useState<AnalyticsPageState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadAnalytics() {
      const tenantId = getSelectedTenantId()
      if (!tenantId) {
        setState((current) => ({ ...current, isLoading: false, selectedTenantId: null }))
        return
      }

      try {
        const [session, data] = await Promise.all([
          getSession(),
          getAnalyticsDashboardData({ page: 1, pageSize: 20, tenantId }),
        ])

        if (!isMounted) {
          return
        }

        setState({
          data,
          error: null,
          eventName: '',
          isLoading: false,
          isRefreshingEvents: false,
          selectedMembership: session.memberships.find((membership) => membership.tenant.id === tenantId) ?? null,
          selectedTenantId: tenantId,
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

    loadAnalytics()

    return () => {
      isMounted = false
    }
  }, [])

  async function refreshEvents(page: number, eventName = state.eventName) {
    if (!state.selectedTenantId || !state.data) {
      return
    }

    setState((current) => ({ ...current, error: null, isRefreshingEvents: true }))

    try {
      const events = await listAnalyticsEvents({ eventName: eventName || undefined, page, pageSize: 20, tenantId: state.selectedTenantId })
      setState((current) =>
        current.data
          ? {
              ...current,
              data: { ...current.data, events },
              eventName,
              isRefreshingEvents: false,
            }
          : current,
      )
    } catch (caughtError) {
      setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), isRefreshingEvents: false }))
    }
  }

  return (
    <InternalShell
      description="Un tablero ejecutivo para seguir salud piloto, gestiones sin actualización y trazabilidad de eventos reales del tenant."
      selectedTenantName={state.selectedMembership?.tenant.name}
      title="Métricas piloto"
    >
      {state.isLoading ? <p className="workspace-note">Cargando métricas reales del tenant…</p> : null}
      {!state.isLoading && !state.selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Seleccionar tenant</ButtonLink>}
          description="Elegí una inmobiliaria antes de abrir métricas. Los reportes internos requieren contexto de tenant."
          title="Seleccioná un tenant para ver métricas"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && state.error && !state.data ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Revisar tenant</ButtonLink>}
          description={state.error}
          title="No pudimos cargar las métricas"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && !state.error && !state.selectedMembership ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir otro tenant</ButtonLink>}
          description="El tenant seleccionado ya no está disponible para tu cuenta o no tenés membresía activa."
          title="El contexto de tenant necesita atención"
        />
      ) : null}
      {state.data && state.selectedMembership ? (
        <section className="analytics-dashboard" aria-label="Dashboard de métricas piloto">
          {state.error ? <p className="auth-form__error">{state.error}</p> : null}
          {state.isRefreshingEvents ? <p className="workspace-note">Actualizando auditoría…</p> : null}
          <Card className="analytics-dashboard__intro" tone="subtle">
            <CardContent>
              <p className="analytics-eyebrow">Health dashboard</p>
              <h2>Señales para conducir el piloto sin inventar datos</h2>
              <p>
                Cada bloque consulta Stage 8 en vivo con <code>x-tenant-id</code>. No hay métricas locales, PostHog ni datos demo en este slice.
              </p>
            </CardContent>
          </Card>
          <PilotSummaryPanel summary={state.data.summary} />
          <InactiveEngagementsPanel response={state.data.inactiveEngagements} />
          <EventAuditTable
            eventName={state.eventName}
            isLoading={state.isRefreshingEvents}
            onEventNameChange={(nextEventName) => refreshEvents(1, nextEventName)}
            onPageChange={(page) => refreshEvents(page)}
            response={state.data.events}
          />
        </section>
      ) : null}
    </InternalShell>
  )
}
