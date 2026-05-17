'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { OwnerShell } from '@/components/layout/owner-shell'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import {
  getOwnerEngagementTimeline,
  getOwnerProperty,
  listOwnerPropertyEngagements,
  type OwnerEngagement,
  type OwnerEngagementStatus,
  type OwnerMovement,
  type OwnerMovementType,
  type OwnerOperationType,
  type OwnerProperty,
  type OwnerPropertyType,
} from '@/lib/owner-portal'

type OwnerPropertyDetailState = {
  engagements: OwnerEngagement[]
  error: string | null
  isLoading: boolean
  movements: OwnerMovement[]
  movementTotal: number
  property: OwnerProperty | null
  timelineEngagement: OwnerEngagement | null
}

const initialState: OwnerPropertyDetailState = {
  engagements: [],
  error: null,
  isLoading: true,
  movements: [],
  movementTotal: 0,
  property: null,
  timelineEngagement: null,
}

const statusLabels: Record<OwnerEngagementStatus, string> = {
  ACTIVE_PUBLICATION: 'Publicación activa',
  CANCELLED: 'Cancelada',
  CAPTURE: 'Captación',
  CLOSED: 'Cerrada',
  DOCUMENTATION_PENDING: 'Documentación pendiente',
  FINAL_DOCUMENTATION: 'Documentación final',
  INQUIRIES_AND_VISITS: 'Consultas y visitas',
  OFFER_NEGOTIATION: 'Negociación de oferta',
  PUBLICATION_PREPARATION: 'Preparando publicación',
  RESERVATION_STARTED: 'Reserva iniciada',
}

const operationLabels: Record<OwnerOperationType, string> = {
  RENT: 'Alquiler',
  SALE: 'Venta',
}

const propertyTypeLabels: Record<OwnerPropertyType, string> = {
  APARTMENT: 'Departamento',
  COMMERCIAL: 'Comercial',
  HOUSE: 'Casa',
  LAND: 'Terreno',
  OTHER: 'Otra propiedad',
}

const movementTypeLabels: Record<OwnerMovementType, string> = {
  DOCUMENTATION_UPDATE: 'Documentación',
  GENERAL_UPDATE: 'Actualización general',
  INQUIRY: 'Consulta',
  OFFER_RECEIVED: 'Oferta recibida',
  STATUS_CHANGE: 'Cambio de estado',
  VISIT_COMPLETED: 'Visita realizada',
  VISIT_SCHEDULED: 'Visita agendada',
}

export default function OwnerPropertyDetailPage() {
  const params = useParams<{ propertyAssetId: string }>()
  const propertyAssetId = params.propertyAssetId
  const [state, setState] = useState<OwnerPropertyDetailState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadPropertyDetail() {
      try {
        const [property, engagements] = await Promise.all([
          getOwnerProperty(propertyAssetId),
          listOwnerPropertyEngagements(propertyAssetId),
        ])
        const timelineEngagement = engagements[0] ?? null
        const timeline = timelineEngagement
          ? await getOwnerEngagementTimeline({ engagementId: timelineEngagement.id, order: 'desc', page: 1, pageSize: 20 })
          : null

        if (!isMounted) {
          return
        }

        setState({
          engagements,
          error: null,
          isLoading: false,
          movements: timeline?.items ?? [],
          movementTotal: timeline?.total ?? 0,
          property,
          timelineEngagement: timeline?.engagement ?? timelineEngagement,
        })
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        setState({
          engagements: [],
          error: getApiErrorMessage(caughtError),
          isLoading: false,
          movements: [],
          movementTotal: 0,
          property: null,
          timelineEngagement: null,
        })
      }
    }

    loadPropertyDetail()

    return () => {
      isMounted = false
    }
  }, [propertyAssetId])

  return (
    <OwnerShell
      description="Detalle de la propiedad, gestiones vinculadas y últimas novedades visibles para propietarios."
      title={state.property?.title ?? 'Detalle de propiedad'}
    >
      {state.isLoading ? <p className="owner-note">Cargando detalle de la propiedad…</p> : null}
      {!state.isLoading && state.error ? (
        <EmptyState
          action={<ButtonLink href="/owner/properties">Volver a mis propiedades</ButtonLink>}
          description={state.error}
          title="No pudimos abrir esta propiedad"
        />
      ) : null}
      {state.property ? (
        <OwnerPropertyDetail
          engagements={state.engagements}
          movements={state.movements}
          movementTotal={state.movementTotal}
          property={state.property}
          timelineEngagement={state.timelineEngagement}
        />
      ) : null}
    </OwnerShell>
  )
}

function OwnerPropertyDetail({
  engagements,
  movements,
  movementTotal,
  property,
  timelineEngagement,
}: {
  engagements: OwnerEngagement[]
  movements: OwnerMovement[]
  movementTotal: number
  property: OwnerProperty
  timelineEngagement: OwnerEngagement | null
}) {
  return (
    <section className="owner-detail" aria-label="Detalle de propiedad para propietario">
      <div className="owner-detail__actions">
        <ButtonLink href="/owner/properties" variant="secondary">
          Volver a mis propiedades
        </ButtonLink>
      </div>

      <Card className="owner-detail__hero">
        <CardContent className="owner-detail__hero-content">
          <div>
            <div className="owner-detail__badges">
              <Badge tone="teal">{propertyTypeLabels[property.propertyType]}</Badge>
              {timelineEngagement ? <Badge tone="brass">{statusLabels[timelineEngagement.status]}</Badge> : null}
            </div>
            <h2>{property.title}</h2>
            <p>{property.addressLine}</p>
            <p>{property.city}, {property.province}</p>
          </div>
          <dl className="owner-detail__stats">
            <div>
              <dt>Tipo de propiedad</dt>
              <dd>{propertyTypeLabels[property.propertyType]}</dd>
            </div>
            <div>
              <dt>Última actualización</dt>
              <dd>{formatDateTime(property.updatedAt)}</dd>
            </div>
            <div>
              <dt>Gestiones asociadas</dt>
              <dd>{engagements.length}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className="owner-detail__grid">
        <OwnerEngagementList engagements={engagements} />
        <OwnerTimelineCard engagement={timelineEngagement} movements={movements} total={movementTotal} />
        <EmptyState
          className="owner-detail__placeholder"
          description="La carga y revisión documental llegan en Slice 6. En este portal no mostramos documentos ficticios."
          title="Documentos de la propiedad"
        />
      </div>
    </section>
  )
}

function OwnerEngagementList({ engagements }: { engagements: OwnerEngagement[] }) {
  return (
    <Card tone="subtle" className="owner-engagements">
      <CardHeader>
        <p className="owner-workspace__eyebrow">Gestiones</p>
        <h2>Operaciones vinculadas</h2>
        <p>Listado real de gestiones habilitadas para esta propiedad.</p>
      </CardHeader>
      <CardContent>
        {engagements.length > 0 ? (
          <ul className="owner-engagements__list" aria-label="Gestiones vinculadas">
            {engagements.map((engagement) => (
              <li className="owner-engagements__item" key={engagement.id}>
                <div>
                  <Badge tone="teal">{statusLabels[engagement.status]}</Badge>
                  <h3>{operationLabels[engagement.operationType]}</h3>
                  <p>{formatPrice(engagement.publishedPriceCents, engagement.currency)}</p>
                </div>
                <dl>
                  <div>
                    <dt>Equipo</dt>
                    <dd>{formatAgentList(engagement)}</dd>
                  </div>
                  <div>
                    <dt>Actualizada</dt>
                    <dd>{formatDateTime(engagement.updatedAt)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <div className="owner-timeline__empty">
            <h3>Sin gestiones asociadas</h3>
            <p>Cuando exista una operación activa o histórica para esta propiedad, va a aparecer acá.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OwnerTimelineCard({
  engagement,
  movements,
  total,
}: {
  engagement: OwnerEngagement | null
  movements: OwnerMovement[]
  total: number
}) {
  return (
    <Card tone="subtle" className="owner-timeline">
      <CardHeader>
        <p className="owner-workspace__eyebrow">Novedades</p>
        <h2>Timeline visible</h2>
        <p>{engagement ? formatTimelineTotal(total, engagement) : 'No hay una gestión disponible para mostrar novedades.'}</p>
      </CardHeader>
      <CardContent>
        {movements.length > 0 ? (
          <ol className="owner-timeline__list" aria-label="Timeline visible para propietario">
            {movements.map((movement) => (
              <li className="owner-timeline__item" key={movement.id}>
                <div className="owner-timeline__marker" aria-hidden="true" />
                <article className="owner-timeline__entry">
                  <div className="owner-timeline__meta">
                    <Badge tone={movement.newStatus ? 'teal' : 'neutral'}>{movementTypeLabels[movement.type]}</Badge>
                    <time dateTime={movement.createdAt}>{formatDateTime(movement.createdAt)}</time>
                  </div>
                  <p className="owner-timeline__observation">{movement.observation}</p>
                  {movement.newStatus ? (
                    <p className="owner-timeline__status">
                      Estado: {movement.previousStatus ? statusLabels[movement.previousStatus] : 'Sin estado previo'} →{' '}
                      {statusLabels[movement.newStatus]}
                    </p>
                  ) : null}
                  {movement.nextStep ? <p className="owner-timeline__next">Próximo paso: {movement.nextStep}</p> : null}
                  <p className="owner-timeline__author">Publicado por {formatAuthor(movement)}</p>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="owner-timeline__empty">
            <h3>Todavía no hay novedades</h3>
            <p>Cuando el equipo publique movimientos visibles, vas a verlos en este timeline.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function formatAgentList(engagement: OwnerEngagement) {
  if (engagement.agents.length === 0) {
    return 'Sin equipo asignado'
  }

  return engagement.agents.map((agent) => agent.firstName || agent.email).join(', ')
}

function formatAuthor(movement: OwnerMovement) {
  return movement.createdBy.firstName ? `${movement.createdBy.firstName} · ${movement.createdBy.email}` : movement.createdBy.email
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

function formatPrice(priceCents?: number | null, currency?: string | null) {
  if (priceCents === undefined || priceCents === null) {
    return 'Precio a definir'
  }

  const amount = priceCents / 100
  const currencyCode = currency || 'ARS'

  try {
    return new Intl.NumberFormat('es-AR', {
      currency: currencyCode,
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(amount)
  } catch {
    return `${currencyCode} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount)}`
  }
}

function formatTimelineTotal(total: number, engagement: OwnerEngagement) {
  const operation = operationLabels[engagement.operationType].toLowerCase()

  if (total === 0) {
    return `Última gestión de ${operation}, sin novedades publicadas todavía.`
  }

  return total === 1
    ? `1 novedad publicada para la gestión de ${operation}.`
    : `${total} novedades publicadas para la gestión de ${operation}.`
}
