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
      description="Un tablero ejecutivo para seguir salud comercial, gestiones sin actualización y señales reales de actividad de la inmobiliaria."
      selectedTenantName={state.selectedMembership?.tenant.name}
      title="Métricas"
    >
      {state.isLoading ? <p className="workspace-note">Cargando métricas de la inmobiliaria…</p> : null}
      {!state.isLoading && !state.selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir inmobiliaria</ButtonLink>}
          description="Elegí una inmobiliaria antes de abrir métricas para ver sus gestiones, documentos y actividad comercial."
          title="Elegí una inmobiliaria para ver métricas"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && state.error && !state.data ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Revisar inmobiliaria</ButtonLink>}
          description={state.error}
          title="No pudimos cargar las métricas"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && !state.error && !state.selectedMembership ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir otra inmobiliaria</ButtonLink>}
          description="La inmobiliaria elegida ya no está disponible para tu cuenta o necesitás que revisen tu acceso."
          title="Necesitamos revisar tu acceso"
        />
      ) : null}
      {state.data && state.selectedMembership ? (
        <section className="analytics-dashboard" aria-label="Métricas de la inmobiliaria">
          {state.error ? <p className="auth-form__error">{state.error}</p> : null}
          {state.isRefreshingEvents ? <p className="workspace-note">Actualizando actividad…</p> : null}
          <Card className="analytics-dashboard__intro" tone="subtle">
            <CardContent>
              <p className="analytics-eyebrow">Pulso operativo</p>
              <h2>Señales para conducir la operación comercial</h2>
              <p>
                Cada bloque usa actividad real de la inmobiliaria. Si todavía no hay movimientos, vas a ver estados honestos para decidir el próximo paso.
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
