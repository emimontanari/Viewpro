'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { OperatorListItem, OperatorRole, OperatorStatus } from '@/features/operators/api/types';
import { OperatorCellAction } from './operator-cell-action';

export type OperatorStatusAction = {
  targetStatus: OperatorStatus;
  label: string;
};

type Props = {
  items: OperatorListItem[];
  isMutating: boolean;
  onChangeRole: (item: OperatorListItem) => void;
  onStatusAction: (item: OperatorListItem, action: OperatorStatusAction) => void;
};

// Callbacks + guard threaded to each cell via the table instance's `meta`
// (mirrors TenantsTableMeta).
type OperatorsTableMeta = {
  isMutating: boolean;
  onChangeRole: (item: OperatorListItem) => void;
  onStatusAction: (item: OperatorListItem, action: OperatorStatusAction) => void;
};

export const columns: ColumnDef<OperatorListItem>[] = [
  {
    id: 'email',
    header: 'Email',
    cell: ({ row }) => <span className='font-medium'>{row.original.email}</span>
  },
  {
    id: 'role',
    header: 'Rol',
    cell: ({ row }) => (
      <RoleBadge role={row.original.role} testId={`operator-role-${row.original.id}`} />
    )
  },
  {
    id: 'status',
    header: 'Estado',
    cell: ({ row }) => (
      <StatusBadge status={row.original.status} testId={`operator-status-${row.original.id}`} />
    )
  },
  {
    id: 'actions',
    header: 'Acciones',
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
    }
  }
];

/**
 * Operator roster table. Built with @tanstack/react-table (mirrors
 * TenantsTable): read-only columns (email/role/status) plus a dropdown
 * actions column (OperatorCellAction). Rows render in the order received.
 * `isMutating` disables every row action while a mutation is in flight.
 */
export function OperatorsTable({ items, isMutating, onChangeRole, onStatusAction }: Props) {
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: { isMutating, onChangeRole, onStatusAction } satisfies OperatorsTableMeta
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
          <TableRow key={row.id} data-testid={`operator-row-${row.original.id}`}>
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

// Single source of truth for the row's status action (mirrors
// getTenantActions, simplified — operators only ever toggle between ACTIVE
// and SUSPENDED, no terminal/destructive third state).
export function getOperatorStatusAction(item: OperatorListItem): OperatorStatusAction {
  return item.status === 'ACTIVE'
    ? { targetStatus: 'SUSPENDED', label: 'Suspender' }
    : { targetStatus: 'ACTIVE', label: 'Reactivar' };
}

function StatusBadge({ status, testId }: { status: OperatorStatus; testId: string }) {
  const variant = status === 'ACTIVE' ? 'default' : 'destructive';

  return (
    <Badge data-testid={testId} variant={variant} className='rounded-full'>
      {getOperatorStatusLabel(status)}
    </Badge>
  );
}

function RoleBadge({ role, testId }: { role: OperatorRole; testId: string }) {
  return (
    <Badge data-testid={testId} variant='outline' className='rounded-full'>
      {getOperatorRoleLabel(role)}
    </Badge>
  );
}

export function getOperatorStatusLabel(status: string) {
  const labels: Record<OperatorStatus, string> = {
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspendido'
  };

  return labels[status as OperatorStatus] ?? status;
}

export function getOperatorRoleLabel(role: string) {
  const labels: Record<OperatorRole, string> = {
    OWNER: 'Dueño',
    OPERATIONS: 'Operaciones',
    ANALYST: 'Analista'
  };

  return labels[role as OperatorRole] ?? role;
}
