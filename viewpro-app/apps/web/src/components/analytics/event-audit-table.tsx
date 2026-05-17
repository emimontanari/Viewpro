'use client'

import { type ChangeEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { analyticsEventNames, type AnalyticsEvent, type AnalyticsEventName, type ListAnalyticsEventsResponse } from '@/lib/analytics'

type EventAuditTableProps = {
  eventName: AnalyticsEventName | ''
  isLoading: boolean
  onEventNameChange: (eventName: AnalyticsEventName | '') => void
  onPageChange: (page: number) => void
  response: ListAnalyticsEventsResponse
}

export function EventAuditTable({ eventName, isLoading, onEventNameChange, onPageChange, response }: EventAuditTableProps) {
  const totalPages = Math.max(1, Math.ceil(response.total / response.pageSize))

  function handleEventNameChange(event: ChangeEvent<HTMLSelectElement>) {
    onEventNameChange(event.currentTarget.value as AnalyticsEventName | '')
  }

  return (
    <Card className="analytics-panel analytics-events" tone="subtle">
      <CardHeader className="analytics-events__header">
        <div>
          <p className="analytics-eyebrow">Auditoría</p>
          <h2>Eventos reales del piloto</h2>
          <p>{response.total === 1 ? '1 evento registrado.' : `${response.total} eventos registrados.`}</p>
        </div>
        <label className="analytics-events__filter">
          <span>Filtrar evento</span>
          <select className="vp-input" disabled={isLoading} onChange={handleEventNameChange} value={eventName}>
            <option value="">Todos los eventos</option>
            {analyticsEventNames.map((name) => (
              <option key={name} value={name}>
                {formatEventName(name)}
              </option>
            ))}
          </select>
        </label>
      </CardHeader>
      <CardContent>
        {response.items.length > 0 ? (
          <div className="analytics-events__table-wrap">
            <table className="analytics-events__table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Actor</th>
                  <th>Contexto</th>
                  <th>Metadata</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {response.items.map((event) => (
                  <tr key={event.id}>
                    <td>{formatEventName(event.eventName)}</td>
                    <td>{formatActor(event.actorType)}</td>
                    <td>{formatContext(event)}</td>
                    <td>{formatMetadata(event.metadata)}</td>
                    <td>
                      <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="analytics-empty-inline">
            <h3>No hay eventos para este filtro</h3>
            <p>Cuando el backend registre actividad del tenant, el detalle auditable va a aparecer acá.</p>
          </div>
        )}
        <div className="analytics-events__pagination">
          <Button disabled={isLoading || response.page <= 1} onClick={() => onPageChange(response.page - 1)} size="sm" variant="secondary">
            Anterior
          </Button>
          <span>
            Página {response.page} de {totalPages}
          </span>
          <Button disabled={isLoading || response.page >= totalPages} onClick={() => onPageChange(response.page + 1)} size="sm" variant="secondary">
            Siguiente
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function formatEventName(eventName: string) {
  const labels: Record<AnalyticsEventName, string> = {
    DOCUMENT_APPROVED: 'Documento aprobado',
    DOCUMENT_REJECTED: 'Documento rechazado',
    DOCUMENT_REQUESTED: 'Documento solicitado',
    DOCUMENT_UPLOADED: 'Documento cargado',
    MOVEMENT_CREATED: 'Movimiento creado',
    OWNER_VIEWED_PROPERTY: 'Propietario vio propiedad',
    PROPERTY_STATUS_CHANGED: 'Estado de propiedad cambiado',
    SELLER_LOGGED_IN: 'Seller inició sesión',
  }

  return labels[eventName as AnalyticsEventName] ?? eventName
}

function formatActor(actorType: string) {
  if (actorType === 'INTERNAL_USER') return 'Equipo interno'
  if (actorType === 'OWNER') return 'Propietario'
  if (actorType === 'SYSTEM') return 'Sistema'
  return actorType
}

function formatContext(event: AnalyticsEvent) {
  const context = [
    event.propertyEngagementId ? `Gestión ${event.propertyEngagementId.slice(0, 8)}` : null,
    event.propertyAssetId ? `Propiedad ${event.propertyAssetId.slice(0, 8)}` : null,
    event.documentRequestId ? `Doc ${event.documentRequestId.slice(0, 8)}` : null,
    event.movementId ? `Mov ${event.movementId.slice(0, 8)}` : null,
  ].filter(Boolean)

  return context.length > 0 ? context.join(' · ') : 'Sin contexto adicional'
}

function formatMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return '—'
  }

  const entries = Object.entries(metadata)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    .slice(0, 3)

  if (entries.length === 0) {
    return '—'
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')
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
