'use client'

import { useEffect, useState } from 'react'

import { OwnerDocumentUpload } from '@/components/documents/owner-document-upload'
import { OwnerShell } from '@/components/layout/owner-shell'
import { ButtonLink } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import { listOwnerDocumentRequests, type DocumentRequest } from '@/lib/documents'

type OwnerDocumentsState = {
  error: string | null
  isLoading: boolean
  requests: DocumentRequest[]
  total: number
}

const initialState: OwnerDocumentsState = {
  error: null,
  isLoading: true,
  requests: [],
  total: 0,
}

export default function OwnerDocumentsPage() {
  const [state, setState] = useState<OwnerDocumentsState>(initialState)

  async function loadDocuments() {
    try {
      const response = await listOwnerDocumentRequests({ page: 1, pageSize: 50 })

      setState({ error: null, isLoading: false, requests: response.items, total: response.total })
    } catch (caughtError) {
      setState({ error: getApiErrorMessage(caughtError), isLoading: false, requests: [], total: 0 })
    }
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialDocuments() {
      try {
        const response = await listOwnerDocumentRequests({ page: 1, pageSize: 50 })

        if (!isMounted) return
        setState({ error: null, isLoading: false, requests: response.items, total: response.total })
      } catch (caughtError) {
        if (!isMounted) return
        setState({ error: getApiErrorMessage(caughtError), isLoading: false, requests: [], total: 0 })
      }
    }

    loadInitialDocuments()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <OwnerShell
      description="Subí los documentos que tu inmobiliaria te pidió y consultá el estado de revisión sin exponer datos internos."
      title="Mis documentos"
    >
      {state.isLoading ? <p className="owner-note">Cargando solicitudes documentales…</p> : null}
      {!state.isLoading && state.error ? (
        <EmptyState
          action={<ButtonLink href="/owner/properties">Volver a mis propiedades</ButtonLink>}
          description={state.error}
          title="No pudimos cargar tus documentos"
        />
      ) : null}
      {!state.error ? <OwnerDocumentUpload onChanged={() => loadDocuments()} requests={state.requests} total={state.total} /> : null}
    </OwnerShell>
  )
}
