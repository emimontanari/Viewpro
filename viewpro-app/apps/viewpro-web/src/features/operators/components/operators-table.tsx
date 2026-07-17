'use client';

import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import type { OperatorListItem, OperatorStatus } from '@/features/operators/api/types';
import { operatorColumns, type OperatorsTableMeta } from './operator-tables/columns';

export {
  getOperatorRoleLabel,
  getOperatorStatusLabel
} from './operator-tables/columns';

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

/**
 * Operator roster table, rebuilt to the Kiranism starter DataTable format
 * (same look as the demo `/dashboard/users`): sortable column headers, an
 * avatar+email identity cell, colored Rol/Estado badges, a formatted "Alta"
 * date, a toolbar (search-by-email + faceted Rol/Estado filters + view-options
 * + reset), a dropdown actions column (OperatorCellAction) and a pagination
 * footer.
 *
 * Everything is CLIENT-SIDE — the `GET /operators/manage` endpoint has no
 * pagination/search/filter params, and the roster is small — so sorting,
 * filtering, faceting and pagination all run on TanStack row models over the
 * full `items` array (no backend change). The shared `useDataTable` hook is
 * deliberately NOT used here: it is wired for server-side/manual pagination via
 * nuqs, which would fight a small client-side list. We render with the shared
 * presentational `DataTable` / `DataTableToolbar` components instead to get the
 * starter's visual format.
 *
 * `isMutating` is threaded to each row's actions via table `meta` and disables
 * every row action while a mutation is in flight (double-submit guard).
 */
export function OperatorsTable({ items, isMutating, onChangeRole, onStatusAction }: Props) {
  const table = useReactTable({
    data: items,
    columns: operatorColumns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: 10 } },
    meta: { isMutating, onChangeRole, onStatusAction } satisfies OperatorsTableMeta
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
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
