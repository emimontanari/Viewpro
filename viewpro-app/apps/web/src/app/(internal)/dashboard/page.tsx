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
      description="Un punto de partida claro para entrar al workspace de gestiones, crear propiedades y preparar los próximos flujos operativos."
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
              <h2>Gestiones internas disponibles</h2>
              <p>Abrí el listado real del tenant o cargá una nueva propiedad sin salir del workspace interno.</p>
              <div className="dashboard-card__actions">
                <ButtonLink href="/engagements" size="sm" variant="secondary">
                  Ver gestiones
                </ButtonLink>
                <ButtonLink href="/engagements/new" size="sm" variant="ghost">
                  Crear gestión
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
          <EmptyState
            action={<ButtonLink href="/engagements">Entrar al workspace de gestiones</ButtonLink>}
            description="Movimientos, documentos, portal de propietario y métricas piloto siguen fuera de este slice. El foco actual es operar gestiones reales del tenant."
            title="El workspace operativo empieza por gestiones"
          />
        </section>
      ) : null}
    </InternalShell>
  )
}
