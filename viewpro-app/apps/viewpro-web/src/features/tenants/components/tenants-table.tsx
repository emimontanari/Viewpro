'use client';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TenantListItem, TenantStatus } from '@/features/tenants/api/types';

type Props = {
  items: TenantListItem[];
};

/**
 * Read-only tenant list table (PR1 scope — no actions column yet, see T-13).
 * Rows render in the order received; the API already sorts name ASC.
 */
export function TenantsTable({ items }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Inquilino</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Límites</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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
