'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TenantListItem, TenantStatus, TenantStatusAction } from '@/features/tenants/api/types';

type Props = {
  items: TenantListItem[];
  isMutating: boolean;
  onEditLimits: (item: TenantListItem) => void;
  onStatusAction: (item: TenantListItem, action: TenantAction) => void;
};

/**
 * Tenant list table. Read-only columns (name/slug/status/limits, PR1) plus an
 * actions column (edit-limits + status actions, T-13/WU-2, widened D6). Rows
 * render in the order received; the API already sorts name ASC. `isMutating`
 * disables every action button on every row (double-submit guard, D11).
 */
export function TenantsTable({ items, isMutating, onEditLimits, onStatusAction }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Inquilino</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Límites</TableHead>
          <TableHead className='text-right'>Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const actions = getTenantActions(item);

          return (
            <TableRow key={item.id} data-testid={`tenant-row-${item.id}`}>
              <TableCell>
                <div className='space-y-1'>
                  <p className='font-medium'>{item.name}</p>
                  <p className='text-muted-foreground text-xs'>{item.slug}</p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} testId={`tenant-status-${item.id}`} />
              </TableCell>
              <TableCell>
                <TenantLimitsSummary limits={item.limits} testId={`tenant-limits-${item.id}`} />
              </TableCell>
              <TableCell className='text-right'>
                <div className='flex justify-end gap-2'>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={isMutating}
                    onClick={() => onEditLimits(item)}
                  >
                    Editar límites
                  </Button>
                  {actions.map((action) => (
                    <Button
                      key={action.kind}
                      type='button'
                      size='sm'
                      variant={
                        action.kind === 'cancel' || action.targetStatus === 'SUSPENDED'
                          ? 'destructive'
                          : 'outline'
                      }
                      disabled={isMutating}
                      onClick={() => onStatusAction(item, action)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// Maps the current status to the available PATCH targets + button labels
// (copy app-new pattern, D14; widened D6). CANCELLED has no actions — the
// row renders zero status-action buttons (terminal, per admin-tenant-status).
export type TenantAction = {
  kind: 'toggle' | 'cancel';
  targetStatus: TenantStatusAction;
  label: string;
};

export function getTenantActions(item: TenantListItem): TenantAction[] {
  const toggle = getToggleAction(item);

  if (!toggle) {
    return [];
  }

  return [toggle, { kind: 'cancel', targetStatus: 'CANCELLED', label: 'Dar de baja' }];
}

function getToggleAction(item: TenantListItem): TenantAction | null {
  if (item.status === 'TRIAL') {
    return { kind: 'toggle', targetStatus: 'ACTIVE', label: 'Activar' };
  }

  if (item.status === 'ACTIVE') {
    return { kind: 'toggle', targetStatus: 'SUSPENDED', label: 'Suspender' };
  }

  if (item.status === 'SUSPENDED') {
    return { kind: 'toggle', targetStatus: 'ACTIVE', label: 'Reactivar' };
  }

  return null;
}

function StatusBadge({ status, testId }: { status: TenantStatus; testId: string }) {
  const variant =
    status === 'ACTIVE' ? 'default' : status === 'SUSPENDED' ? 'destructive' : 'outline';

  return (
    <Badge data-testid={testId} variant={variant} className='rounded-full'>
      {getStatusLabel(status)}
    </Badge>
  );
}

function TenantLimitsSummary({
  limits,
  testId
}: {
  limits: TenantListItem['limits'];
  testId: string;
}) {
  const rows = [
    { label: 'Usuarios', value: formatLimitValue(limits.maxUsers) },
    {
      label: 'Publicaciones activas',
      value: formatLimitValue(limits.maxActivePropertyEngagements)
    },
    { label: 'Storage documentos', value: formatStorageLimit(limits.maxDocumentsStorageMb) }
  ];

  return (
    <dl data-testid={testId} className='text-muted-foreground space-y-1 text-xs'>
      {rows.map((row) => (
        <div key={row.label} className='flex min-w-48 justify-between gap-3'>
          <dt>{row.label}</dt>
          <dd className='text-foreground font-medium'>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Status may render an unexpected raw value gracefully rather than throwing
// (the server column is a raw string — D4/D14).
export function getStatusLabel(status: string) {
  const labels: Record<TenantStatus, string> = {
    TRIAL: 'Trial',
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspendido',
    CANCELLED: 'Cancelado'
  };

  return labels[status as TenantStatus] ?? status;
}

function formatLimitValue(value: number | null) {
  return value === null ? 'Sin límite' : formatNumber(value);
}

function formatStorageLimit(value: number | null) {
  return value === null ? 'Sin límite' : `${formatNumber(value)} MB`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-AR').format(value);
}
