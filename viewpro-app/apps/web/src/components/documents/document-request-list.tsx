'use client'

import { type FormEvent, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getApiErrorMessage } from '@/lib/api-client'
import {
  approveDocumentRequest,
  createInternalDocumentReadUrl,
  rejectDocumentRequest,
  type DocumentRequest,
  type DocumentRequestStatus,
  type DocumentVersion,
} from '@/lib/documents'

type DocumentRequestListProps = {
  requests: DocumentRequest[]
  total: number
  tenantId: string
  onChanged: () => Promise<void> | void
}

type ActionState = {
  error: string | null
  pendingAction: string | null
  success: string | null
}

const statusLabels: Record<DocumentRequestStatus, string> = {
  APPROVED: 'Aprobado',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazado',
  SUBMITTED: 'En revisión',
}

export function DocumentRequestList({ requests, total, tenantId, onChanged }: DocumentRequestListProps) {
  const [state, setState] = useState<ActionState>({ error: null, pendingAction: null, success: null })

  async function runAction(actionKey: string, action: () => Promise<void>, success: string) {
    setState({ error: null, pendingAction: actionKey, success: null })

    try {
      await action()
      await onChanged()
      setState({ error: null, pendingAction: null, success })
    } catch (caughtError) {
      setState({ error: getApiErrorMessage(caughtError), pendingAction: null, success: null })
    }
  }

  async function handleOpenVersion(version: DocumentVersion) {
    await runAction(
      `read-${version.id}`,
      async () => {
        const response = await createInternalDocumentReadUrl(tenantId, version.id)
        window.open(response.readUrl.url, '_blank', 'noopener,noreferrer')
      },
      'URL de lectura generada.',
    )
  }

  return (
    <Card tone="subtle" className="document-requests">
      <CardHeader>
        <p className="engagement-workspace__eyebrow">Documentos</p>
        <h2>Solicitudes de esta gestión</h2>
        <p>{formatTotal(total, requests.length)}</p>
      </CardHeader>
      <CardContent>
        {state.error ? <p className="auth-form__error">{state.error}</p> : null}
        {state.success ? (
          <p className="document-form__success" role="status">
            {state.success}
          </p>
        ) : null}
        {requests.length > 0 ? (
          <ul className="document-requests__list" aria-label="Solicitudes documentales">
            {requests.map((request) => (
              <li className="document-requests__item" key={request.id}>
                <article>
                  <div className="document-requests__meta">
                    <Badge tone={getStatusTone(request.status)}>{statusLabels[request.status]}</Badge>
                    <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
                  </div>
                  <h3>{request.title}</h3>
                  <p>{request.description || 'Sin detalle adicional.'}</p>
                  {request.currentVersion ? <VersionSummary version={request.currentVersion} /> : <p>Sin archivo cargado todavía.</p>}
                  {request.rejectionReason ? <p className="document-requests__reason">Motivo: {request.rejectionReason}</p> : null}
                </article>
                <div className="document-requests__actions">
                  {request.currentVersion ? (
                    <Button
                      disabled={state.pendingAction === `read-${request.currentVersion.id}`}
                      onClick={() => handleOpenVersion(request.currentVersion as DocumentVersion)}
                      size="sm"
                      variant="secondary"
                    >
                      {state.pendingAction === `read-${request.currentVersion.id}` ? 'Generando…' : 'Ver archivo'}
                    </Button>
                  ) : null}
                  {request.status === 'SUBMITTED' ? (
                    <>
                      <Button
                        disabled={state.pendingAction === `approve-${request.id}`}
                        onClick={() =>
                          runAction(
                            `approve-${request.id}`,
                            () => approveDocumentRequest(tenantId, request.id).then(() => undefined),
                            'Documento aprobado.',
                          )
                        }
                        size="sm"
                      >
                        {state.pendingAction === `approve-${request.id}` ? 'Aprobando…' : 'Aprobar'}
                      </Button>
                      <RejectDocumentForm
                        disabled={Boolean(state.pendingAction)}
                        onReject={(reason) =>
                          runAction(
                            `reject-${request.id}`,
                            () => rejectDocumentRequest(tenantId, request.id, reason).then(() => undefined),
                            'Documento rechazado.',
                          )
                        }
                      />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="document-requests__empty">
            <h3>Todavía no hay solicitudes</h3>
            <p>Cuando el equipo pida documentos para esta gestión, van a aparecer acá.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RejectDocumentForm({ disabled, onReject }: { disabled: boolean; onReject: (reason: string) => void }) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const reason = getRequiredValue(formData, 'reason')

    if (!reason) {
      return
    }

    onReject(reason)
    form.reset()
  }

  return (
    <form className="document-requests__reject" onSubmit={handleSubmit}>
      <input className="vp-input" maxLength={2000} name="reason" placeholder="Motivo de rechazo" required />
      <Button disabled={disabled} size="sm" type="submit" variant="danger">
        Rechazar
      </Button>
    </form>
  )
}

function VersionSummary({ version }: { version: DocumentVersion }) {
  return (
    <p className="document-requests__version">
      Archivo: {version.originalFilename} · {formatFileSize(version.sizeBytes)} · {formatVersionStatus(version.status)}
    </p>
  )
}

function getStatusTone(status: DocumentRequestStatus) {
  if (status === 'APPROVED') return 'success'
  if (status === 'REJECTED') return 'danger'
  if (status === 'SUBMITTED') return 'teal'
  return 'neutral'
}

function formatVersionStatus(status: DocumentVersion['status']) {
  const labels: Record<DocumentVersion['status'], string> = {
    APPROVED: 'aprobado',
    PENDING_UPLOAD: 'pendiente de carga',
    REJECTED: 'rechazado',
    UPLOADED: 'cargado',
  }

  return labels[status]
}

function formatTotal(total: number, visible: number) {
  if (total === 0) return 'No hay solicitudes documentales para esta gestión.'
  if (total === visible) return total === 1 ? '1 solicitud real cargada.' : `${total} solicitudes reales cargadas.`
  return `${visible} solicitudes visibles para esta gestión dentro de ${total} solicitudes recuperadas.`
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
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

function getRequiredValue(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}
