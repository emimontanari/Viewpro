'use client';

import type { ColumnDef } from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { cn } from '@/lib/utils';
import type { OperatorListItem, OperatorRole, OperatorStatus } from '@/features/operators/api/types';
import { OperatorCellAction } from '../operator-cell-action';
import type { OperatorStatusAction } from '../operators-table';
import { ROLE_OPTIONS, STATUS_OPTIONS } from './options';

// Callbacks + guard threaded to each cell via the table instance's `meta`
// (react-table's escape hatch for passing container state into ColumnDef cells;
// mirrors TenantsTableMeta).
export type OperatorsTableMeta = {
  isMutating: boolean;
  onChangeRole: (item: OperatorListItem) => void;
  onStatusAction: (item: OperatorListItem, action: OperatorStatusAction) => void;
};

// Faceted-filter predicate: the toolbar stores the selection as a string[]; a
// row matches when its raw enum value is one of the selected values (mirrors
// the shadcn/Kiranism faceted-filter contract).
function includesSelected(row: { getValue: (id: string) => unknown }, id: string, value: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  return value.includes(row.getValue(id) as string);
}

export const operatorColumns: ColumnDef<OperatorListItem>[] = [
  {
    id: 'email',
    accessorKey: 'email',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Operador' />,
    cell: ({ row }) => <OperatorIdentity item={row.original} />,
    enableColumnFilter: true,
    meta: {
      label: 'Operador',
      variant: 'text',
      placeholder: 'Buscar por email...'
    }
  },
  {
    id: 'role',
    accessorKey: 'role',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Rol' />,
    cell: ({ row }) => (
      <RoleBadge role={row.original.role} testId={`operator-role-${row.original.id}`} />
    ),
    enableColumnFilter: true,
    filterFn: includesSelected,
    meta: {
      label: 'Rol',
      variant: 'multiSelect',
      options: ROLE_OPTIONS
    }
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Estado' />,
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} testId={`operator-status-${row.original.id}`} />
    ),
    enableColumnFilter: true,
    filterFn: includesSelected,
    meta: {
      label: 'Estado',
      variant: 'multiSelect',
      options: STATUS_OPTIONS
    }
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Alta' />,
    cell: ({ row }) => (
      <span className='text-muted-foreground text-sm whitespace-nowrap'>
        {formatDate(row.original.createdAt)}
      </span>
    ),
    enableColumnFilter: false,
    meta: { label: 'Alta' }
  },
  {
    id: 'actions',
    header: () => <span className='sr-only'>Acciones</span>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as OperatorsTableMeta;

      return (
        <OperatorCellAction
          item={row.original}
          isMutating={meta.isMutating}
          onChangeRole={meta.onChangeRole}
          onStatusAction={meta.onStatusAction}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false
  }
];

// Avatar-initial + email identity cell (mirrors the starter's user rows: a
// circle with the first letter of the email + the email itself).
function OperatorIdentity({ item }: { item: OperatorListItem }) {
  const initial = item.email.charAt(0).toUpperCase();

  return (
    <div className='flex items-center gap-3'>
      <span
        aria-hidden='true'
        data-testid={`operator-avatar-${item.id}`}
        className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium'
      >
        {initial}
      </span>
      <span className='font-medium'>{item.email}</span>
    </div>
  );
}

// Distinct badge tones per role (OWNER prominent → primary; OPERATIONS →
// secondary; ANALYST muted → outline).
function RoleBadge({ role, testId }: { role: OperatorRole; testId: string }) {
  const variant = role === 'OWNER' ? 'default' : role === 'OPERATIONS' ? 'secondary' : 'outline';

  return (
    <Badge data-testid={testId} variant={variant} className='rounded-full'>
      {getOperatorRoleLabel(role)}
    </Badge>
  );
}

// ACTIVE → green/positive; SUSPENDED → red/destructive.
function StatusBadge({ status, testId }: { status: OperatorStatus; testId: string }) {
  if (status === 'ACTIVE') {
    return (
      <Badge
        data-testid={testId}
        variant='outline'
        className={cn(
          'rounded-full border-transparent',
          'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
        )}
      >
        {getOperatorStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <Badge data-testid={testId} variant='destructive' className='rounded-full'>
      {getOperatorStatusLabel(status)}
    </Badge>
  );
}

// Calendar date in UTC so the "Alta" column is deterministic regardless of the
// viewer's / test runner's local timezone.
function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);
}

export function getOperatorRoleLabel(role: string) {
  const labels: Record<OperatorRole, string> = {
    OWNER: 'Dueño',
    OPERATIONS: 'Operaciones',
    ANALYST: 'Analista'
  };

  return labels[role as OperatorRole] ?? role;
}

export function getOperatorStatusLabel(status: string) {
  const labels: Record<OperatorStatus, string> = {
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspendido'
  };

  return labels[status as OperatorStatus] ?? status;
}
