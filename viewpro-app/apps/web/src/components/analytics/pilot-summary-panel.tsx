import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { PilotSummary } from '@/lib/analytics'

type PilotSummaryPanelProps = {
  summary: PilotSummary
}

export function PilotSummaryPanel({ summary }: PilotSummaryPanelProps) {
  const updatePercentage = Math.min(100, Math.max(0, summary.activeEngagementUpdatePercentage))

  return (
    <Card className="analytics-summary" tone="subtle">
      <CardHeader>
        <p className="analytics-eyebrow">Pulso semanal</p>
        <h2>{updatePercentage}% de gestiones activas con actualización visible</h2>
        <p>
          Ventana piloto del {formatDate(summary.window.from)} al {formatDate(summary.window.to)}.
        </p>
      </CardHeader>
      <CardContent className="analytics-summary__content">
        <div className="analytics-summary__meter" aria-label={`${updatePercentage}% de gestiones actualizadas`}>
          <span style={{ width: `${updatePercentage}%` }} />
        </div>
        <dl className="analytics-kpi-grid">
          <Metric label="Gestiones activas" value={summary.activeEngagements} />
          <Metric label="Con actualización visible" value={summary.activeEngagementsWithOwnerVisibleUpdate} />
          <Metric label="Vistas de propietarios" value={summary.ownerViewedPropertyCount} />
          <Metric label="Documentos solicitados" value={summary.documentEvents.requested} />
          <Metric label="Documentos cargados" value={summary.documentEvents.uploaded} />
          <Metric label="Aprobados / rechazados" value={`${summary.documentEvents.approved} / ${summary.documentEvents.rejected}`} />
        </dl>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(new Date(value))
}
