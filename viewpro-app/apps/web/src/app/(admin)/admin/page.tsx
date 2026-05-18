'use client'

import { useEffect, useState } from 'react'

import { AdminShell } from '@/components/layout/admin-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { getApiErrorMessage } from '@/lib/api-client'
import {
  getAdminDashboardData,
  listAdminActivity,
  listAdminTenants,
  type AdminActivityListResponse,
  type AdminDashboardData,
  type AdminSummary,
  type AdminTenantsResponse,
} from '@/lib/admin'
import { getSession } from '@/lib/session'

type AdminPageState = {
  activityTenantId: string
  data: AdminDashboardData | null
  error: string | null
  isLoading: boolean
  isRefreshingActivity: boolean
  isRefreshingTenants: boolean
  role: 'unknown' | 'forbidden' | 'admin'
  tenantStatus: string
}

const initialState: AdminPageState = {
  activityTenantId: '',
  data: null,
  error: null,
  isLoading: true,
  isRefreshingActivity: false,
  isRefreshingTenants: false,
  role: 'unknown',
  tenantStatus: '',
}

const tenantStatuses = ['', 'ACTIVE', 'SUSPENDED']

export default function AdminPage() {
  const [state, setState] = useState<AdminPageState>(initialState)

  useEffect(() => {
    let isMounted = true

    async function loadAdmin() {
      try {
        const session = await getSession()

        if (!isMounted) {
          return
        }

        if (session.user.globalRole !== 'VIEWPRO_ADMIN') {
          setState((current) => ({ ...current, isLoading: false, role: 'forbidden' }))
          return
        }

        const data = await getAdminDashboardData()

        if (!isMounted) {
          return
        }

        setState({
          ...initialState,
          data,
          isLoading: false,
          role: 'admin',
        })
      } catch (caughtError) {
        if (!isMounted) {
          return
        }

        setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), isLoading: false }))
      }
    }

    loadAdmin()

    return () => {
      isMounted = false
    }
  }, [])

  async function refreshTenants(page: number, status = state.tenantStatus) {
    if (!state.data) {
      return
    }

    setState((current) => ({ ...current, error: null, isRefreshingTenants: true }))

    try {
      const tenants = await listAdminTenants({ page, pageSize: state.data.tenants.pageSize, status: status || undefined })
      setState((current) =>
        current.data
          ? {
              ...current,
              data: { ...current.data, tenants },
              isRefreshingTenants: false,
              tenantStatus: status,
            }
          : current,
      )
    } catch (caughtError) {
      setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), isRefreshingTenants: false }))
    }
  }

  async function refreshActivity(page: number, tenantId = state.activityTenantId) {
    if (!state.data) {
      return
    }

    setState((current) => ({ ...current, error: null, isRefreshingActivity: true }))

    try {
      const activity = await listAdminActivity({ page, pageSize: state.data.activity.pageSize, tenantId: tenantId || undefined })
      setState((current) =>
        current.data
          ? {
              ...current,
              activityTenantId: tenantId,
              data: { ...current.data, activity },
              isRefreshingActivity: false,
            }
          : current,
      )
    } catch (caughtError) {
      setState((current) => ({ ...current, error: getApiErrorMessage(caughtError), isRefreshingActivity: false }))
    }
  }

  return (
    <AdminShell
      description="Vista operacional global para monitorear el piloto completo sin usar contexto de tenant ni exponer datos privados."
      title="Admin ViewPro"
    >
      {state.isLoading ? <p className="workspace-note">Cargando consola admin…</p> : null}
      {!state.isLoading && state.role === 'forbidden' ? (
        <EmptyState
          description="Necesitás rol global VIEWPRO_ADMIN para abrir este comando operativo. Los roles tenant no conceden acceso admin."
          title="Acceso restringido a ViewPro Admin"
        />
      ) : null}
      {!state.isLoading && state.role !== 'forbidden' && state.error && !state.data ? (
        <EmptyState description={state.error} title="No pudimos cargar el admin" />
      ) : null}
      {state.data ? (
        <section className="admin-command" aria-label="Panel admin read-only">
          {state.error ? <p className="auth-form__error">{state.error}</p> : null}
          <Card className="admin-command__intro" tone="subtle">
            <CardContent>
              <p className="admin-eyebrow">Frontera segura</p>
              <h2>Read-only v1: sin impersonación, edición, borrado, billing ni acceso a documentos privados.</h2>
              <p>
                Esta pantalla consume sólo read models sanitizados de <code>/api/admin</code> con cookie auth. No envía <code>x-tenant-id</code> ni lee el tenant seleccionado del workspace.
              </p>
            </CardContent>
          </Card>
          <AdminSummarySection summary={state.data.summary} />
          <AdminTenantsSection
            isLoading={state.isRefreshingTenants}
            onPageChange={(page) => refreshTenants(page)}
            onStatusChange={(status) => refreshTenants(1, status)}
            response={state.data.tenants}
            status={state.tenantStatus}
          />
          <AdminActivitySection
            isLoading={state.isRefreshingActivity}
            onPageChange={(page) => refreshActivity(page)}
            onTenantIdChange={(tenantId) => refreshActivity(1, tenantId)}
            response={state.data.activity}
            tenantId={state.activityTenantId}
          />
        </section>
      ) : null}
    </AdminShell>
  )
}

function AdminSummarySection({ summary }: { summary: AdminSummary }) {
  const items = [
    ['Tenants', summary.totals.tenants],
    ['Tenants activos', summary.totals.activeTenants],
    ['Usuarios', summary.totals.users],
    ['Gestiones activas', summary.totals.activeEngagements],
    ['Documentos', summary.totals.documentRequests],
    ['Eventos', summary.totals.analyticsEvents],
  ] as const

  return (
    <Card id="admin-summary" className="admin-summary">
      <CardContent>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Salud global</p>
            <h2>Señales operativas del piloto</h2>
          </div>
          <Badge tone="teal">{summary.recentActivityCount} eventos recientes</Badge>
        </div>
        <dl className="admin-kpi-grid">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatNumber(value)}</dd>
            </div>
          ))}
        </dl>
        <p>Generado: {formatDateTime(summary.generatedAt)}</p>
      </CardContent>
    </Card>
  )
}

function AdminTenantsSection({
  isLoading,
  onPageChange,
  onStatusChange,
  response,
  status,
}: {
  isLoading: boolean
  onPageChange: (page: number) => void
  onStatusChange: (status: string) => void
  response: AdminTenantsResponse
  status: string
}) {
  return (
    <Card id="admin-tenants" className="admin-panel admin-panel--wide">
      <CardContent>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Tenants</p>
            <h2>Inmobiliarias monitoreadas</h2>
          </div>
          <label className="admin-filter">
            Estado
            <select className="vp-input" value={status} onChange={(event) => onStatusChange(event.target.value)}>
              {tenantStatuses.map((tenantStatus) => (
                <option key={tenantStatus || 'all'} value={tenantStatus}>
                  {tenantStatus || 'Todos'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {isLoading ? <p className="workspace-note">Actualizando tenants…</p> : null}
        {response.items.length === 0 ? (
          <InlineEmpty title="No hay tenants para este filtro" description="Probá limpiar el estado para revisar el universo completo." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Estado</th>
                  <th>Uso</th>
                  <th>Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {response.items.map((tenant) => (
                  <tr key={tenant.id}>
                    <td>
                      <h3>{tenant.name}</h3>
                      <p>{tenant.slug}</p>
                    </td>
                    <td>{tenant.status}</td>
                    <td>
                      {tenant.counts.propertyEngagements} gestiones · {tenant.counts.documentRequests} documentos · {tenant.counts.analyticsEvents} eventos
                    </td>
                    <td>{tenant.lastActivityAt ? formatDateTime(tenant.lastActivityAt) : 'Sin actividad registrada'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={response.page} pageSize={response.pageSize} total={response.total} onPageChange={onPageChange} />
      </CardContent>
    </Card>
  )
}

function AdminActivitySection({
  isLoading,
  onPageChange,
  onTenantIdChange,
  response,
  tenantId,
}: {
  isLoading: boolean
  onPageChange: (page: number) => void
  onTenantIdChange: (tenantId: string) => void
  response: AdminActivityListResponse
  tenantId: string
}) {
  return (
    <Card id="admin-activity" className="admin-panel admin-panel--wide">
      <CardContent>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Auditoría global</p>
            <h2>Actividad reciente sanitizada</h2>
          </div>
          <form
            className="admin-filter"
            onSubmit={(event) => {
              event.preventDefault()
              const formData = new FormData(event.currentTarget)
              onTenantIdChange(String(formData.get('tenantId') ?? '').trim())
            }}
          >
            <label htmlFor="admin-activity-tenant">Tenant ID</label>
            <div className="admin-filter__row">
              <input id="admin-activity-tenant" className="vp-input" name="tenantId" defaultValue={tenantId} placeholder="UUID opcional" />
              <Button size="sm" variant="secondary" type="submit">
                Filtrar
              </Button>
            </div>
          </form>
        </div>
        {isLoading ? <p className="workspace-note">Actualizando actividad…</p> : null}
        {response.items.length === 0 ? (
          <InlineEmpty title="No hay actividad para mostrar" description="La auditoría aparece cuando los tenants generan eventos del piloto." />
        ) : (
          <ul className="admin-activity-list">
            {response.items.map((activity) => (
              <li key={activity.id}>
                <div>
                  <strong>{activity.eventName}</strong>
                  <p>
                    {activity.actorType} · {activity.tenantId ?? 'Sin tenant'} · {formatDateTime(activity.occurredAt)}
                  </p>
                </div>
                <span>{activity.propertyEngagementId ?? activity.propertyAssetId ?? activity.documentRequestId ?? activity.movementId ?? 'Referencia sanitizada'}</span>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={response.page} pageSize={response.pageSize} total={response.total} onPageChange={onPageChange} />
      </CardContent>
    </Card>
  )
}

function Pagination({
  onPageChange,
  page,
  pageSize,
  total,
}: {
  onPageChange: (page: number) => void
  page: number
  pageSize: number
  total: number
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="admin-pagination">
      <Button disabled={page <= 1} size="sm" variant="secondary" onClick={() => onPageChange(page - 1)}>
        Anterior
      </Button>
      <span>
        Página {page} de {totalPages}
      </span>
      <Button disabled={page >= totalPages} size="sm" variant="secondary" onClick={() => onPageChange(page + 1)}>
        Siguiente
      </Button>
    </div>
  )
}

function InlineEmpty({ description, title }: { description: string; title: string }) {
  return (
    <div className="admin-empty-inline">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR').format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
