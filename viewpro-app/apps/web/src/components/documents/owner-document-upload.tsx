'use client'

import { type ChangeEvent, type FormEvent, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getApiErrorMessage } from '@/lib/api-client'
import {
  confirmOwnerDocumentUpload,
  createOwnerDocumentReadUrl,
  createOwnerDocumentUploadUrl,
  type DocumentRequest,
  type DocumentRequestStatus,
  type DocumentVersion,
} from '@/lib/documents'

type OwnerDocumentUploadProps = {
  requests: DocumentRequest[]
  total: number
  onChanged: () => Promise<void> | void
}

type UploadState = {
  error: string | null
  pendingAction: string | null
  selectedFiles: Record<string, File | undefined>
  success: string | null
}

const maxUploadSizeBytes = 10 * 1024 * 1024

const statusLabels: Record<DocumentRequestStatus, string> = {
  APPROVED: 'Aprobado',
  PENDING: 'Pendiente de carga',
  REJECTED: 'Requiere corrección',
  SUBMITTED: 'En revisión',
}

export function OwnerDocumentUpload({ requests, total, onChanged }: OwnerDocumentUploadProps) {
  const [state, setState] = useState<UploadState>({ error: null, pendingAction: null, selectedFiles: {}, success: null })

  function handleFileChange(requestId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    setState((current) => ({
      ...current,
      error: null,
      selectedFiles: { ...current.selectedFiles, [requestId]: file },
      success: null,
    }))
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>, request: DocumentRequest) {
    event.preventDefault()
    const file = state.selectedFiles[request.id]

    if (!file) {
      setState((current) => ({ ...current, error: 'Elegí un archivo antes de subirlo.' }))
      return
    }

    if (file.size > maxUploadSizeBytes) {
      setState((current) => ({ ...current, error: 'El archivo no puede superar los 10 MB.' }))
      return
    }

    setState((current) => ({ ...current, error: null, pendingAction: `upload-${request.id}`, success: null }))

    try {
      const upload = await createOwnerDocumentUploadUrl({
        mimeType: file.type || 'application/octet-stream',
        originalFilename: file.name,
        requestId: request.id,
        sizeBytes: file.size,
      })

      const uploadResponse = await fetch(upload.uploadUrl.url, {
        body: file,
        headers: { 'content-type': file.type || 'application/octet-stream' },
        method: 'PUT',
      })

      if (!uploadResponse.ok) {
        throw new Error('No pudimos subir el archivo al almacenamiento firmado.')
      }

      await confirmOwnerDocumentUpload(upload.version.id)
      await onChanged()

      setState((current) => ({
        error: null,
        pendingAction: null,
        selectedFiles: { ...current.selectedFiles, [request.id]: undefined },
        success: `Archivo enviado para ${request.title}.`,
      }))
      event.currentTarget.reset()
    } catch (caughtError) {
      setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), pendingAction: null }))
    }
  }

  async function handleOpenVersion(version: DocumentVersion) {
    setState((current) => ({ ...current, error: null, pendingAction: `read-${version.id}`, success: null }))

    try {
      const response = await createOwnerDocumentReadUrl(version.id)
      window.open(response.readUrl.url, '_blank', 'noopener,noreferrer')
      setState((current) => ({ ...current, pendingAction: null, success: 'URL de lectura generada.' }))
    } catch (caughtError) {
      setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), pendingAction: null }))
    }
  }

  return (
    <Card tone="subtle" className="owner-documents-card">
      <CardHeader>
        <p className="owner-workspace__eyebrow">Documentos</p>
        <h2>Solicitudes pendientes</h2>
        <p>{formatOwnerTotal(total)}</p>
      </CardHeader>
      <CardContent>
        {state.error ? <p className="auth-form__error">{state.error}</p> : null}
        {state.success ? (
          <p className="document-form__success" role="status">
            {state.success}
          </p>
        ) : null}
        {requests.length > 0 ? (
          <ul className="owner-documents__list" aria-label="Solicitudes documentales del propietario">
            {requests.map((request) => (
              <li className="owner-documents__item" key={request.id}>
                <article>
                  <div className="owner-documents__meta">
                    <Badge tone={getStatusTone(request.status)}>{statusLabels[request.status]}</Badge>
                    <time dateTime={request.createdAt}>{formatDateTime(request.createdAt)}</time>
                  </div>
                  <h3>{request.title}</h3>
                  <p>{request.description || 'El equipo necesita que subas este archivo para continuar.'}</p>
                  {request.currentVersion ? <VersionSummary version={request.currentVersion} /> : null}
                  {request.rejectionReason ? <p className="document-requests__reason">Motivo: {request.rejectionReason}</p> : null}
                </article>
                {request.status === 'PENDING' || request.status === 'REJECTED' ? (
                  <form className="owner-documents__upload" onSubmit={(event) => handleUpload(event, request)}>
                    <input
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      className="vp-input"
                      name="document"
                      onChange={(event) => handleFileChange(request.id, event)}
                      type="file"
                    />
                    <Button disabled={state.pendingAction === `upload-${request.id}`} type="submit">
                      {state.pendingAction === `upload-${request.id}` ? 'Subiendo archivo…' : 'Subir documento'}
                    </Button>
                  </form>
                ) : null}
                {request.currentVersion ? (
                  <Button
                    disabled={state.pendingAction === `read-${request.currentVersion.id}`}
                    onClick={() => handleOpenVersion(request.currentVersion as DocumentVersion)}
                    size="sm"
                    variant="secondary"
                  >
                    {state.pendingAction === `read-${request.currentVersion.id}` ? 'Generando…' : 'Ver archivo enviado'}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <div className="owner-documents__empty">
            <h3>No tenés documentos pendientes</h3>
            <p>Cuando tu inmobiliaria solicite documentación, vas a poder subirla desde este espacio.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VersionSummary({ version }: { version: DocumentVersion }) {
  return (
    <p className="document-requests__version">
      Último archivo: {version.originalFilename} · {formatFileSize(version.sizeBytes)} · {formatVersionStatus(version.status)}
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
    PENDING_UPLOAD: 'pendiente de confirmación',
    REJECTED: 'rechazado',
    UPLOADED: 'enviado',
  }

  return labels[status]
}

function formatOwnerTotal(total: number) {
  if (total === 0) return 'No hay solicitudes documentales activas en este momento.'
  return total === 1 ? '1 solicitud documental real.' : `${total} solicitudes documentales reales.`
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
