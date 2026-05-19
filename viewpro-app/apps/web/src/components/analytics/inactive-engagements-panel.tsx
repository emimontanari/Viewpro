import Link from 'next/link'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { ListInactiveEngagementsResponse } from '@/lib/analytics'

type InactiveEngagementsPanelProps = {
  response: ListInactiveEngagementsResponse
}

export function InactiveEngagementsPanel({ response }: InactiveEngagementsPanelProps) {
  return (
    <Card className="analytics-panel analytics-inactive" tone="subtle">
      <CardHeader>
        <p className="analytics-eyebrow">Riesgo operativo</p>
        <h2>Gestiones sin actualización reciente</h2>
        <p>
          Activas sin novedades visibles para propietarios entre {formatDate(response.window.from)} y {formatDate(response.window.to)}.
        </p>
      </CardHeader>
      <CardContent>
        {response.items.length > 0 ? (
          <ul className="analytics-inactive__list" aria-label="Gestiones inactivas">
            {response.items.map((engagement) => (
              <li key={engagement.id}>
                <div>
                  <h3>{shortenId(engagement.propertyAssetId)}</h3>
                  <p>Última actualización: {formatDateTime(engagement.updatedAt)}</p>
                </div>
                <Link href={`/engagements/${engagement.id}`}>{formatStatus(engagement.status)}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="analytics-empty-inline">
            <h3>No hay gestiones inactivas</h3>
            <p>La inmobiliaria no tiene gestiones activas pendientes de actualización en esta ventana.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function shortenId(value: string) {
  return `Propiedad ${value.slice(0, 8)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
