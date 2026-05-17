'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import {
  formatEngagementStatus,
  formatOperationType,
  formatPrice,
  formatPropertyType,
} from '@/components/engagements/engagement-summary-card'
import { DocumentRequestList } from '@/components/documents/document-request-list'
import { RequestDocumentForm } from '@/components/documents/request-document-form'
import { InternalShell } from '@/components/layout/internal-shell'
import { CreateMovementForm } from '@/components/movements/create-movement-form'
import { MovementTimeline } from '@/components/movements/movement-timeline'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { listInternalDocumentRequests, type DocumentRequest } from '@/lib/documents'
import { getEngagement, type PropertyEngagement } from '@/lib/engagements'
import { listMovements, type Movement } from '@/lib/movements'
import { getSession, type TenantMembership } from '@/lib/session'
import { getSelectedTenantId } from '@/lib/tenant-selection'

type DetailState = {
  documentRequests: DocumentRequest[]
  documentTotal: number
  engagement: PropertyEngagement | null
  error: string | null
  isLoading: boolean
  movements: Movement[]
  movementTotal: number
  selectedMembership: TenantMembership | null
  selectedTenantId: string | null
}

const initialState: DetailState = {
  documentRequests: [],
  documentTotal: 0,
  engagement: null,
  error: null,
  isLoading: true,
  movements: [],
  movementTotal: 0,
  selectedMembership: null,
  selectedTenantId: null,
}

export default function EngagementDetailPage() {
  const params = useParams<{ id: string }>()
  const engagementId = params.id
  const [state, setState] = useState<DetailState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadEngagement() {
      const tenantId = getSelectedTenantId()
      if (!tenantId) {
        setState((current) => ({ ...current, isLoading: false, selectedTenantId: null }))
        return
      }

      try {
        const [session, engagement, movementsResponse, documentRequestsResponse] = await Promise.all([
          getSession(),
          getEngagement(tenantId, engagementId),
          listMovements({ order: 'desc', page: 1, pageSize: 20, propertyEngagementId: engagementId, tenantId }),
          listInternalDocumentRequests({ page: 1, pageSize: 50, tenantId }),
        ])
        const engagementDocumentRequests = documentRequestsResponse.items.filter(
          (request) => request.propertyEngagementId === engagementId,
        )

        if (!isMounted) {
          return
        }

        setState({
          documentRequests: engagementDocumentRequests,
          documentTotal: engagementDocumentRequests.length,
          engagement,
          error: null,
          isLoading: false,
          movements: movementsResponse.items,
          movementTotal: movementsResponse.total,
          selectedMembership: session.memberships.find((membership) => membership.tenant.id === tenantId) ?? null,
          selectedTenantId: tenantId,
        })
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        setState((current) => ({
          ...current,
          documentRequests: [],
          documentTotal: 0,
          error: getApiErrorMessage(caughtError),
          isLoading: false,
          movements: [],
          movementTotal: 0,
          selectedTenantId: tenantId,
        }))
      }
    }

    loadEngagement()

    return () => {
      isMounted = false
    }
  }, [engagementId])

  const selectedTenantId = state.selectedTenantId

  return (
    <InternalShell
      description="Detalle operativo de la propiedad, su estado actual y los espacios preparados para los próximos flujos de movimientos y documentos."
      selectedTenantName={state.selectedMembership?.tenant.name}
      title={state.engagement?.property.title ?? 'Detalle de gestión'}
    >
      {state.isLoading ? <p className="workspace-note">Cargando detalle de la gestión…</p> : null}
      {!state.isLoading && !state.selectedTenantId ? (
        <EmptyState
          action={<ButtonLink href="/select-tenant">Seleccionar tenant</ButtonLink>}
          description="Elegí una inmobiliaria antes de consultar una gestión interna."
          title="Seleccioná un tenant para continuar"
        />
      ) : null}
      {!state.isLoading && state.selectedTenantId && state.error ? (
        <EmptyState
          action={<ButtonLink href="/engagements">Volver a gestiones</ButtonLink>}
          description={state.error}
          title="No pudimos abrir esta gestión"
        />
      ) : null}
      {state.engagement && selectedTenantId ? (
        <EngagementDetail
          documentRequests={state.documentRequests}
          documentTotal={state.documentTotal}
          engagement={state.engagement}
          movements={state.movements}
          movementTotal={state.movementTotal}
          onMovementCreated={async () => {
            const [engagement, movementsResponse] = await Promise.all([
              getEngagement(selectedTenantId, engagementId),
              listMovements({
                order: 'desc',
                page: 1,
                pageSize: 20,
                propertyEngagementId: engagementId,
                tenantId: selectedTenantId,
              }),
            ])

            setState((current) => ({
              ...current,
              engagement,
              movements: movementsResponse.items,
              movementTotal: movementsResponse.total,
            }))
          }}
          onDocumentsChanged={async () => {
            const documentsResponse = await listInternalDocumentRequests({ page: 1, pageSize: 50, tenantId: selectedTenantId })
            const engagementDocumentRequests = documentsResponse.items.filter(
              (request) => request.propertyEngagementId === engagementId,
            )

            setState((current) => ({
              ...current,
              documentRequests: engagementDocumentRequests,
              documentTotal: engagementDocumentRequests.length,
            }))
          }}
          tenantId={selectedTenantId}
        />
      ) : null}
    </InternalShell>
  )
}

function EngagementDetail({
  documentRequests,
  documentTotal,
  engagement,
  movements,
  movementTotal,
  onDocumentsChanged,
  onMovementCreated,
  tenantId,
}: {
  documentRequests: DocumentRequest[]
  documentTotal: number
  engagement: PropertyEngagement
  movements: Movement[]
  movementTotal: number
  onDocumentsChanged: () => Promise<void>
  onMovementCreated: () => Promise<void>
  tenantId: string
}) {
  const ownerSummary = [engagement.property.ownerName, engagement.property.ownerEmail].filter(Boolean).join(' · ')

  return (
    <section className="engagement-detail" aria-label="Detalle de gestión">
      <div className="engagement-detail__actions">
        <ButtonLink href="/engagements" variant="secondary">
          Volver al listado
        </ButtonLink>
        <ButtonLink href="/engagements/new" variant="ghost">
          Crear otra gestión
        </ButtonLink>
      </div>

      <Card className="engagement-detail__hero">
        <CardContent className="engagement-detail__hero-content">
          <div>
            <div className="engagement-detail__badges">
              <Badge tone="teal">{formatEngagementStatus(engagement.status)}</Badge>
              <Badge tone="brass">{formatOperationType(engagement.operationType)}</Badge>
            </div>
            <h2>{engagement.property.title}</h2>
            <p>{engagement.property.addressLine}</p>
            <p>{engagement.property.city}, {engagement.property.province}</p>
          </div>
          <dl className="engagement-detail__stats">
            <div>
              <dt>Tipo de propiedad</dt>
              <dd>{formatPropertyType(engagement.property.propertyType)}</dd>
            </div>
            <div>
              <dt>Precio publicado</dt>
              <dd>{formatPrice(engagement.publishedPriceCents, engagement.currency)}</dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd>{formatDateTime(engagement.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="engagement-detail__grid">
        <Card tone="subtle">
          <CardHeader>
            <p className="engagement-workspace__eyebrow">Propietario</p>
            <h2>Resumen de contacto</h2>
          </CardHeader>
          <CardContent className="engagement-detail__panel">
            <p>{ownerSummary || 'Sin datos de propietario cargados todavía.'}</p>
          </CardContent>
        </Card>

        <Card tone="subtle">
          <CardHeader>
            <p className="engagement-workspace__eyebrow">Equipo</p>
            <h2>Asignaciones</h2>
          </CardHeader>
          <CardContent className="engagement-detail__panel">
            {engagement.agents.length > 0 ? (
              <ul className="engagement-detail__agent-list">
                {engagement.agents.map((agent) => (
                  <li key={agent.id}>{agent.firstName ? `${agent.firstName} · ${agent.email}` : agent.email}</li>
                ))}
              </ul>
            ) : (
              <p>Esta gestión todavía no tiene agentes asignados.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="engagement-detail__grid">
        <MovementTimeline movements={movements} total={movementTotal} />
        <CreateMovementForm
          currentStatus={engagement.status}
          onCreated={onMovementCreated}
          propertyEngagementId={engagement.id}
          tenantId={tenantId}
        />
        <DocumentRequestList
          onChanged={onDocumentsChanged}
          requests={documentRequests}
          tenantId={tenantId}
          total={documentTotal}
        />
        <RequestDocumentForm
          onCreated={onDocumentsChanged}
          ownerEmail={engagement.property.ownerEmail}
          propertyEngagementId={engagement.id}
          tenantId={tenantId}
        />
      </div>
    </section>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
