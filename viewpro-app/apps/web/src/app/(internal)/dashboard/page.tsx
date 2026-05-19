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

function formatBusinessRole(role: string) {
  const normalizedRole = role.toUpperCase()

  if (normalizedRole === 'OWNER' || normalizedRole === 'ADMIN') {
    return 'Administración'
  }

  if (normalizedRole === 'AGENT') {
    return 'Equipo comercial'
  }

  return 'Operación'
}

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
      description="Tu punto de partida para ver qué requiere atención hoy y entrar rápido a las áreas operativas de la inmobiliaria."
      selectedTenantName={selectedMembership?.tenant.name}
      title="Inicio"
    >
      {isLoading ? <p className="workspace-note">Preparando el panel de tu inmobiliaria…</p> : null}
      {!isLoading && !selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir inmobiliaria</ButtonLink>}
          description="Seleccioná con cuál inmobiliaria querés trabajar para ver sus gestiones, documentos, propietarios y métricas."
          title="Elegí una inmobiliaria para continuar"
        />
      ) : null}
      {!isLoading && selectedTenantId && !selectedMembership ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Elegir otra inmobiliaria</ButtonLink>}
          description={error ?? 'La inmobiliaria elegida ya no está disponible para tu cuenta. Elegí otra para continuar.'}
          title="Necesitamos revisar tu acceso"
        />
      ) : null}
      {selectedMembership ? (
        <section className="dashboard-home" aria-label="Inicio operativo de la inmobiliaria">
          <Card className="dashboard-home__overview" tone="subtle">
            <CardContent className="dashboard-overview">
              <div>
                <span className="dashboard-kicker">Inmobiliaria activa</span>
                <h2>{selectedMembership.tenant.name}</h2>
                <p>
                  Estás trabajando como {formatBusinessRole(selectedMembership.role).toLowerCase()}. Desde acá podés
                  entrar a gestiones, documentos, propietarios y métricas sin perder el hilo operativo.
                </p>
              </div>
              <div className="dashboard-overview__actions">
                <ButtonLink href="/engagements/new">Nueva gestión</ButtonLink>
                <ButtonLink href="/engagements" variant="secondary">
                  Ver gestiones
                </ButtonLink>
              </div>
            </CardContent>
          </Card>

          <div className="dashboard-home__grid">
            <Card className="dashboard-home__priority" tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Hoy</span>
                <h2>Prioridades de hoy</h2>
                <ul className="dashboard-list">
                  <li>Revisá las gestiones activas y agregá próximos pasos comerciales.</li>
                  <li>Confirmá si hay documentos para preparar antes de hablar con propietarios.</li>
                  <li>Usá métricas para detectar actividad pendiente de seguimiento.</li>
                </ul>
              </CardContent>
            </Card>

            <Card tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Operación</span>
                <h2>Gestiones activas</h2>
                <p>Entrá al listado real de gestiones o cargá una propiedad nueva cuando llegue una captación.</p>
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

            <Card id="documentos" tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Documentos</span>
                <h2>Documentos</h2>
                <p>Los documentos se gestionan dentro de cada gestión para mantenerlos unidos a la propiedad correcta.</p>
                <ButtonLink href="/engagements" size="sm" variant="secondary">
                  Ir a gestiones
                </ButtonLink>
              </CardContent>
            </Card>

            <Card id="propietarios" tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Relación comercial</span>
                <h2>Propietarios</h2>
                <p>Los portales para propietarios se abren desde cada gestión, con movimientos y documentos asociados.</p>
                <ButtonLink href="/engagements" size="sm" variant="secondary">
                  Buscar gestión
                </ButtonLink>
              </CardContent>
            </Card>

            <Card id="propiedades" tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Inventario</span>
                <h2>Propiedades</h2>
                <p>La vista dedicada de propiedades llega en un próximo paso; por ahora cada propiedad vive dentro de su gestión.</p>
                <ButtonLink href="/engagements/new" size="sm" variant="secondary">
                  Cargar propiedad
                </ButtonLink>
              </CardContent>
            </Card>

            <Card id="equipo" tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Vendedores</span>
                <h2>Equipo comercial</h2>
                <p>La administración de vendedores llega en el próximo slice. Hoy podés ver y asignar responsables dentro de cada gestión.</p>
                <ButtonLink href="/engagements" size="sm" variant="secondary">
                  Ver responsables
                </ButtonLink>
              </CardContent>
            </Card>

            <Card tone="subtle">
              <CardContent className="dashboard-card">
                <span className="dashboard-kicker">Seguimiento</span>
                <h2>Métricas</h2>
                <p>Consultá señales piloto de actividad para entender qué necesita seguimiento comercial.</p>
                <ButtonLink href="/analytics" size="sm" variant="secondary">
                  Revisar métricas
                </ButtonLink>
              </CardContent>
            </Card>
          </div>

          <Card tone="subtle">
            <CardContent className="dashboard-quick-actions">
              <div>
                <span className="dashboard-kicker">Accesos rápidos</span>
                <h2>¿Dónde querés operar ahora?</h2>
              </div>
              <div className="dashboard-card__actions">
                <ButtonLink href="/engagements/new" size="sm">
                  Nueva gestión
                </ButtonLink>
                <ButtonLink href="/engagements" size="sm" variant="secondary">
                  Gestiones
                </ButtonLink>
                <ButtonLink href="/analytics" size="sm" variant="secondary">
                  Métricas
                </ButtonLink>
                <ButtonLink href="/select-tenant" size="sm" variant="ghost">
                  Cambiar inmobiliaria
                </ButtonLink>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </InternalShell>
  )
}
