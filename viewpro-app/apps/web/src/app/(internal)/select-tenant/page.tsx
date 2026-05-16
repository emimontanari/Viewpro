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
      description="Elegí el contexto de inmobiliaria para operar las pantallas con alcance de tenant."
      title="Seleccionar tenant"
    >
      <section className="tenant-selector" aria-label="Membresías de tenant disponibles">
        {isLoading ? <p className="workspace-note">Cargando tus membresías…</p> : null}
        {error ? (
          <EmptyState
            description={`${error} Volvé a ingresar si tu sesión expiró.`}
            title="No pudimos cargar tus membresías"
          />
        ) : null}
        {!isLoading && !error && memberships.length === 0 ? (
          <EmptyState
            description="Tu cuenta está autenticada, pero todavía no está asociada a una inmobiliaria. Pedile a un admin que te agregue antes de entrar al workspace."
            title="No encontramos membresías de tenant"
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
                <Button onClick={() => selectTenant(membership)}>Entrar al workspace</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </InternalShell>
  )
}
