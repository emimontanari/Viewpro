'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TenantListItem, TenantStatus, TenantStatusAction } from '@/features/tenants/api/types';
import { TenantCellAction } from './tenant-cell-action';

type Props = {
  items: TenantListItem[];
  isMutating: boolean;
  onEditLimits: (item: TenantListItem) => void;
  onStatusAction: (item: TenantListItem, action: TenantAction) => void;
};

// Callbacks + guard threaded to each cell via the table instance's `meta`
// (react-table's escape hatch for passing container state into ColumnDef cells).
type TenantsTableMeta = {
  isMutating: boolean;
  onEditLimits: (item: TenantListItem) => void;
  onStatusAction: (item: TenantListItem, action: TenantAction) => void;
};

export const columns: ColumnDef<TenantListItem>[] = [
  {
    id: 'name',
    header: 'Inmobiliaria',
    cell: ({ row }) => (
      <div className='space-y-1'>
        <p className='font-medium'>{row.original.name}</p>
        <p className='text-muted-foreground text-xs'>{row.original.slug}</p>
      </div>
    )
  },
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) => (
      <div className='space-y-1'>
        <StatusBadge status={row.original.status} testId={`tenant-status-${row.original.id}`} />
        {row.original.status === 'TRIAL' && (
          <p
            className='text-muted-foreground text-xs'
            data-testid={`tenant-trial-${row.original.id}`}
          >
            {getTrialEndLabel(row.original.trialEndsAt, new Date())}
          </p>
        )}
      </div>
    )
  },
  {
    id: 'limits',
    header: 'Límites',
    cell: ({ row }) => (
      <TenantLimitsSummary limits={row.original.limits} testId={`tenant-limits-${row.original.id}`} />
    )
  },
  {
    id: 'actions',
    header: 'Acciones',
    cell: ({ row, table }) => {
      const meta = table.options.meta as TenantsTableMeta;

      return (
        <TenantCellAction
          item={row.original}
          isMutating={meta.isMutating}
          onEditLimits={meta.onEditLimits}
          onStatusAction={meta.onStatusAction}
        />
      );
    }
  }
];

/**
 * Tenant list table. Built with @tanstack/react-table (mirrors the InmoView
 * products-table pattern): read-only columns (name/slug/status/limits) plus a
 * dropdown actions column (TenantCellAction, fed by getTenantActions). Rows
 * render in the order received; the API already sorts name ASC. `isMutating`
 * disables every row action while a mutation is in flight (double-submit guard).
 */
export function TenantsTable({ items, isMutating, onEditLimits, onStatusAction }: Props) {
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { isMutating, onEditLimits, onStatusAction } satisfies TenantsTableMeta
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.id === 'actions' ? 'text-right' : undefined}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id} data-testid={`tenant-row-${row.original.id}`}>
            {row.getVisibleCells().map((cell) => (
              <TableCell
                key={cell.id}
                className={cell.column.id === 'actions' ? 'text-right' : undefined}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Maps the current status to the available PATCH targets + item labels
// (copy app-new pattern, D14; widened D6). CANCELLED has no actions — the
// row renders zero status-action items (terminal, per admin-tenant-status).
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Purely informational trial-end label (nothing enforces the date this
// slice). `now` is an explicit param so the rendering call site controls
// the clock (real Date at render time) while tests inject a fixed value.
export function getTrialEndLabel(trialEndsAt: string | null, now: Date): string {
  if (trialEndsAt === null) {
    return '—';
  }

  const msRemaining = new Date(trialEndsAt).getTime() - now.getTime();

  if (msRemaining <= 0) {
    return 'Trial vencido';
  }

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  return daysRemaining === 1 ? 'Vence en 1 día' : `Vence en ${daysRemaining} días`;
}
