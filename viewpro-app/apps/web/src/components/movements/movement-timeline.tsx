import { formatEngagementStatus } from '@/components/engagements/engagement-summary-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { Movement, MovementType } from '@/lib/movements'

type MovementTimelineProps = {
  movements: Movement[]
  total: number
}

const movementTypeLabels: Record<MovementType, string> = {
  DOCUMENTATION_UPDATE: 'Documentación',
  GENERAL_UPDATE: 'Actualización general',
  INQUIRY: 'Consulta',
  OFFER_RECEIVED: 'Oferta recibida',
  STATUS_CHANGE: 'Cambio de estado',
  VISIT_COMPLETED: 'Visita realizada',
  VISIT_SCHEDULED: 'Visita agendada',
}

export function MovementTimeline({ movements, total }: MovementTimelineProps) {
  return (
    <Card tone="subtle" className="movement-timeline">
      <CardHeader>
        <p className="engagement-workspace__eyebrow">Movimientos</p>
        <h2>Timeline operativo</h2>
        <p>
          {total === 1
            ? '1 movimiento real publicado para esta gestión.'
            : `${total} movimientos reales publicados para esta gestión.`}
        </p>
      </CardHeader>
      <CardContent>
        {movements.length > 0 ? (
          <ol className="movement-timeline__list" aria-label="Timeline de movimientos publicados">
            {movements.map((movement) => (
              <li className="movement-timeline__item" key={movement.id}>
                <div className="movement-timeline__marker" aria-hidden="true" />
                <article className="movement-timeline__entry">
                  <div className="movement-timeline__meta">
                    <Badge tone={movement.newStatus ? 'teal' : 'neutral'}>{movementTypeLabels[movement.type]}</Badge>
                    <time dateTime={movement.createdAt}>{formatDateTime(movement.createdAt)}</time>
                  </div>
                  <p className="movement-timeline__observation">{movement.observation}</p>
                  {movement.newStatus ? (
                    <p className="movement-timeline__status">
                      Estado: {movement.previousStatus ? formatEngagementStatus(movement.previousStatus) : 'Sin estado previo'} →{' '}
                      {formatEngagementStatus(movement.newStatus)}
                    </p>
                  ) : null}
                  {movement.nextStep ? <p className="movement-timeline__next">Próximo paso: {movement.nextStep}</p> : null}
                  <p className="movement-timeline__author">Publicado por {formatAuthor(movement)}</p>
                </article>
              </li>
            ))}
          </ol>
        ) : (
          <div className="movement-timeline__empty">
            <h3>Todavía no hay movimientos</h3>
            <p>Publicá el primer update real para dejar trazabilidad visible de la operación.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function formatMovementType(type: MovementType) {
  return movementTypeLabels[type]
}

function formatAuthor(movement: Movement) {
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
