'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { InternalShell } from '@/components/layout/internal-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { getSession } from '@/lib/session'
import type { TenantMembership } from '@/lib/session'
import { clearSelectedTenantId, setSelectedTenantId } from '@/lib/tenant-selection'

export default function SelectTenantPage() {
  const router = useRouter()
  const [memberships, setMemberships] = useState<TenantMembership[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadSession() {
      try {
        const session = await getSession()
        if (!isMounted) {
          return
        }

        setMemberships(session.memberships)
        if (session.memberships.length === 0) {
          clearSelectedTenantId()
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(getApiErrorMessage(caughtError))
          clearSelectedTenantId()
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadSession()

    return () => {
      isMounted = false
    }
  }, [])

  function selectTenant(membership: TenantMembership) {
    setSelectedTenantId(membership.tenant.id)
    router.push('/dashboard')
  }

  return (
    <InternalShell
      description="Elegí con cuál inmobiliaria querés trabajar hoy. Después podés cambiarla desde Configuración."
      title="Elegir inmobiliaria"
    >
      <section className="tenant-selector" aria-label="Inmobiliarias disponibles">
        {isLoading ? <p className="workspace-note">Cargando tus inmobiliarias…</p> : null}
        {error ? (
          <EmptyState
            description={`${error} Volvé a ingresar si tu sesión expiró.`}
            title="No pudimos cargar tus inmobiliarias"
          />
        ) : null}
        {!isLoading && !error && memberships.length === 0 ? (
          <EmptyState
            description="Tu cuenta todavía no está asociada a una inmobiliaria. Pedile a un administrador que te agregue para poder operar."
            title="No encontramos inmobiliarias disponibles"
          />
        ) : null}
        <div className="tenant-selector__grid">
          {memberships.map((membership) => (
            <Card key={membership.id} tone="subtle">
              <CardContent className="tenant-card">
                <div>
                  <Badge tone="brass">{membership.role}</Badge>
                  <h2>{membership.tenant.name}</h2>
                  <p>{membership.tenant.slug}</p>
                </div>
                <Button onClick={() => selectTenant(membership)}>Entrar al panel</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </InternalShell>
  )
}
