'use client'

import { useEffect, useState } from 'react'

import { InternalShell } from '@/components/layout/internal-shell'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { getSession } from '@/lib/session'
import type { TenantMembership } from '@/lib/session'
import { getSelectedTenantId } from '@/lib/tenant-selection'

export default function DashboardPage() {
  const [selectedMembership, setSelectedMembership] = useState<TenantMembership | null>(null)
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadDashboardSession() {
      const tenantId = getSelectedTenantId()
      if (!tenantId) {
        setIsLoading(false)
        return
      }

      setSelectedTenantId(tenantId)

      try {
        const session = await getSession()
        if (!isMounted) {
          return
        }

        setSelectedMembership(session.memberships.find((membership) => membership.tenant.id === tenantId) ?? null)
      } catch (caughtError) {
        if (isMounted) {
          setError(getApiErrorMessage(caughtError))
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboardSession()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <InternalShell
      description="Un punto de partida claro para los próximos flujos de gestiones, movimientos, documentos y métricas piloto."
      selectedTenantName={selectedMembership?.tenant.name}
      title="Dashboard de inmobiliaria"
    >
      {isLoading ? <p className="workspace-note">Abriendo tu workspace…</p> : null}
      {!isLoading && !selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Seleccionar tenant</ButtonLink>}
          description="Elegí una inmobiliaria antes de usar pantallas con alcance de tenant. ViewPro guarda localmente sólo el id del tenant seleccionado; la autenticación queda en cookies del backend."
          title="Seleccioná un tenant para continuar"
        />
      ) : null}
      {!isLoading && selectedTenantId && !selectedMembership ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir otro tenant</ButtonLink>}
          description={error ?? 'El tenant seleccionado ya no está disponible para tu cuenta.'}
          title="El contexto de tenant necesita atención"
        />
      ) : null}
      {selectedMembership ? (
        <section className="dashboard-grid" aria-label="Estado inicial del workspace">
          <Card tone="subtle">
            <CardContent className="dashboard-card">
              <span>01</span>
              <h2>Contexto de tenant listo</h2>
              <p>{selectedMembership.tenant.name} está seleccionado y listo para futuras requests con alcance de tenant.</p>
            </CardContent>
          </Card>
          <Card tone="subtle">
            <CardContent className="dashboard-card">
              <span>02</span>
              <h2>Gestiones en el próximo slice</h2>
              <p>Listados, detalles y creación de gestiones quedan fuera de este slice por diseño.</p>
            </CardContent>
          </Card>
          <EmptyState
            description="Este placeholder deja preparado el shell interno y el estado de tenant seleccionado sin fingir que ya existen datos de gestiones."
            title="Las pantallas operativas llegan en el próximo slice"
          />
        </section>
      ) : null}
    </InternalShell>
  )
}
