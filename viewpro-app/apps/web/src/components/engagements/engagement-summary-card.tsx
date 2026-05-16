import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { PropertyEngagement, PropertyEngagementStatus, PropertyOperationType, PropertyType } from '@/lib/engagements'

type EngagementSummaryCardProps = {
  engagement: PropertyEngagement
}

const statusLabels: Record<PropertyEngagementStatus, string> = {
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

const operationLabels: Record<PropertyOperationType, string> = {
  RENT: 'Alquiler',
  SALE: 'Venta',
}

const propertyTypeLabels: Record<PropertyType, string> = {
  APARTMENT: 'Departamento',
  COMMERCIAL: 'Comercial',
  HOUSE: 'Casa',
  LAND: 'Terreno',
  OTHER: 'Otra propiedad',
}

export function EngagementSummaryCard({ engagement }: EngagementSummaryCardProps) {
  const location = [engagement.property.city, engagement.property.province].filter(Boolean).join(', ')

  return (
    <Card tone="subtle" className="engagement-card">
      <CardContent className="engagement-card__content">
        <div className="engagement-card__topline">
          <Badge tone="teal">{statusLabels[engagement.status]}</Badge>
          <span>{operationLabels[engagement.operationType]}</span>
        </div>
        <div className="engagement-card__main">
          <div>
            <h2>{engagement.property.title}</h2>
            <p>{engagement.property.addressLine}</p>
            <p>{location}</p>
          </div>
          <dl className="engagement-card__meta">
            <div>
              <dt>Tipo</dt>
              <dd>{propertyTypeLabels[engagement.property.propertyType]}</dd>
            </div>
            <div>
              <dt>Equipo</dt>
              <dd>{engagement.agents.length > 0 ? `${engagement.agents.length} asignado(s)` : 'Sin asignar'}</dd>
            </div>
            <div>
              <dt>Actualizada</dt>
              <dd>{formatDate(engagement.updatedAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="engagement-card__footer">
          <span>{formatPrice(engagement.publishedPriceCents, engagement.currency)}</span>
          <ButtonLink href={`/engagements/${engagement.id}`} size="sm" variant="secondary">
            Abrir gestión
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  )
}

export function formatEngagementStatus(status: PropertyEngagementStatus) {
  return statusLabels[status]
}

export function formatOperationType(operationType: PropertyOperationType) {
  return operationLabels[operationType]
}

export function formatPropertyType(propertyType: PropertyType) {
  return propertyTypeLabels[propertyType]
}

export function formatPrice(priceCents?: number | null, currency?: string | null) {
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
