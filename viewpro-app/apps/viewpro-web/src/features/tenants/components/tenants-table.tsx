'use client';

import {
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row
} from '@tanstack/react-table';

import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { cn } from '@/lib/utils';
import type { Option } from '@/types/data-table';
import Link from 'next/link';
import type {
  TenantLimits,
  TenantListItem,
  TenantPlan,
  TenantStatus,
  TenantStatusAction
} from '@/features/tenants/api/types';
import { TenantCellAction } from './tenant-cell-action';
import { BillingCell } from '@/features/payments/components/billing-cell';

type Props = {
  items: TenantListItem[];
  isMutating: boolean;
  onEditLimits: (item: TenantListItem) => void;
  onStatusAction: (item: TenantListItem, action: TenantAction) => void;
  onAssignPlan: (item: TenantListItem) => void;
  onOpenPayments: (item: TenantListItem) => void;
};

// Callbacks + guard threaded to each cell via the table instance's `meta`
// (react-table's escape hatch for passing container state into ColumnDef cells;
// mirrors OperatorsTableMeta).
export type TenantsTableMeta = {
  isMutating: boolean;
  onEditLimits: (item: TenantListItem) => void;
  onStatusAction: (item: TenantListItem, action: TenantAction) => void;
  onAssignPlan: (item: TenantListItem) => void;
  onOpenPayments: (item: TenantListItem) => void;
};

// Sentinel used as the faceted-filter value for a null (unassigned) plan — the
// plan accessorFn maps `null → 'NONE'` so the "Sin plan" facet can match it.
const NO_PLAN = 'NONE';

// Faceted-filter option lists for the toolbar. The `value`s are the raw server
// enum values (TenantStatus / TenantPlan, plus the NO_PLAN sentinel); the
// `label`s are the Spanish console copy shown in the faceted-filter popover.
const STATUS_OPTIONS: Option[] = [
  { label: 'Activo', value: 'ACTIVE' },
  { label: 'Trial', value: 'TRIAL' },
  { label: 'Suspendido', value: 'SUSPENDED' },
  { label: 'Baja', value: 'CANCELLED' }
];

const PLAN_OPTIONS: Option[] = [
  { label: 'Básico', value: 'BASICO' },
  { label: 'Profesional', value: 'PROFESIONAL' },
  { label: 'Empresa', value: 'EMPRESA' },
  { label: 'Sin plan', value: NO_PLAN }
];

// Faceted-filter predicate: the toolbar stores the selection as a string[]; a
// row matches when its raw enum value is one of the selected values (mirrors
// the shadcn/Kiranism faceted-filter contract).
function includesSelected(row: Row<TenantListItem>, id: string, value: string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    return true;
  }

  return value.includes(row.getValue(id) as string);
}

// Free-text search predicate for the "Inmobiliaria" column — matches the query
// against BOTH the name and the slug (the toolbar only wires one text input).
function searchNameOrSlug(row: Row<TenantListItem>, _id: string, value: string) {
  const query = String(value ?? '').trim().toLowerCase();
  if (query.length === 0) {
    return true;
  }

  const { name, slug } = row.original;
  return name.toLowerCase().includes(query) || slug.toLowerCase().includes(query);
}

export const columns: ColumnDef<TenantListItem>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Inmobiliaria' />,
    cell: ({ row }) => <TenantIdentity item={row.original} />,
    enableColumnFilter: true,
    filterFn: searchNameOrSlug,
    size: 260,
    meta: {
      label: 'Inmobiliaria',
      variant: 'text',
      placeholder: 'Buscar por nombre o slug...'
    }
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Estado' />,
    cell: ({ row }) => <StatusCell item={row.original} />,
    enableColumnFilter: true,
    filterFn: includesSelected,
    size: 150,
    meta: {
      label: 'Estado',
      variant: 'multiSelect',
      options: STATUS_OPTIONS
    }
  },
  {
    id: 'billing',
    // platform-payment-ledger: the only surface that reveals a lapsed tenant,
    // since nothing suspends one automatically ("warn, don't cut").
    accessorFn: (item) => item.billing?.paidThroughAt ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Pago hasta' />,
    cell: ({ row }) => (
      <BillingCell billing={row.original.billing} testId={`tenant-billing-${row.original.id}`} />
    ),
    size: 170,
    meta: {
      label: 'Pago hasta'
    }
  },
  {
    id: 'plan',
    // Map null → NO_PLAN so the "Sin plan" facet (and sorting) has a value to
    // match; the cell renders from row.original.plan (not this accessor).
    accessorFn: (item) => item.plan ?? NO_PLAN,
    header: ({ column }) => <DataTableColumnHeader column={column} title='Plan' />,
    cell: ({ row }) => (
      <PlanBadge plan={row.original.plan} testId={`tenant-plan-${row.original.id}`} />
    ),
    enableColumnFilter: true,
    filterFn: includesSelected,
    size: 140,
    meta: {
      label: 'Plan',
      variant: 'multiSelect',
      options: PLAN_OPTIONS
    }
  },
  {
    id: 'limits',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Límites' />,
    cell: ({ row }) => (
      <TenantLimitsSummary
        limits={row.original.limits}
        testId={`tenant-limits-${row.original.id}`}
      />
    ),
    enableSorting: false,
    enableColumnFilter: false,
    size: 200,
    meta: { label: 'Límites' }
  },
  {
    id: 'actions',
    header: () => <span className='sr-only'>Acciones</span>,
    cell: ({ row, table }) => {
      const meta = table.options.meta as TenantsTableMeta;

      return (
        <TenantCellAction
          item={row.original}
          isMutating={meta.isMutating}
          onEditLimits={meta.onEditLimits}
          onStatusAction={meta.onStatusAction}
          onAssignPlan={meta.onAssignPlan}
          onOpenPayments={meta.onOpenPayments}
        />
      );
    },
    enableSorting: false,
    enableHiding: false,
    enableColumnFilter: false,
    size: 64
  }
];

/**
 * Tenant registry table, rebuilt to the Kiranism starter DataTable format (same
 * look as OperatorsTable / the demo `/dashboard/users`): an avatar+name identity
 * cell, colored Estado/Plan badges, a COMPACT + CONTAINED Límites summary (the
 * bleed fix — a single truncated line with an explicit max-width, replacing the
 * old wide right-aligned `<dl>` that spilled into the Plan column), a toolbar
 * (search-by-name/slug + faceted Estado/Plan filters + view-options + reset),
 * the unchanged TenantCellAction dropdown and a pagination footer.
 *
 * Everything is CLIENT-SIDE (TanStack row models over the full `items` array):
 * sorting, free-text search, faceted filtering, faceting and pagination all run
 * on the client — no backend change. `isMutating` is threaded to each row's
 * actions via table `meta` and disables every row action while a mutation is in
 * flight (double-submit guard).
 */
export function TenantsTable({
  items,
  isMutating,
  onEditLimits,
  onStatusAction,
  onAssignPlan,
  onOpenPayments
}: Props) {
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    initialState: { pagination: { pageSize: 10 } },
    meta: {
      isMutating,
      onEditLimits,
      onStatusAction,
      onAssignPlan,
      onOpenPayments
    } satisfies TenantsTableMeta
  });

  return (
    <DataTable table={table}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

// Avatar-initial + name identity cell (mirrors OperatorIdentity): a circle with
// the first letter of the name, the name (primary), and the slug (muted
// subtitle). `min-w-0` + `truncate` keep long names/slugs contained so they
// never push the neighbouring columns.
function TenantIdentity({ item }: { item: TenantListItem }) {
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <div className='flex items-center gap-3'>
      <span
        aria-hidden='true'
        data-testid={`tenant-avatar-${item.id}`}
        className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium'
      >
        {initial}
      </span>
      <div className='min-w-0'>
        <Link
          href={`/dashboard/tenants/${item.id}`}
          className='block truncate font-medium hover:underline'
        >
          {item.name}
        </Link>
        <p className='text-muted-foreground truncate text-xs'>{item.slug}</p>
      </div>
    </div>
  );
}

// Estado cell: the colored status badge plus (for TRIAL rows only) a small
// trial-end sub-line — the trial info is folded into the Estado column rather
// than a separate column, to keep the table narrow.
function StatusCell({ item }: { item: TenantListItem }) {
  return (
    <div className='space-y-1'>
      <StatusBadge status={item.status} testId={`tenant-status-${item.id}`} />
      {item.status === 'TRIAL' && (
        <p className='text-muted-foreground text-xs' data-testid={`tenant-trial-${item.id}`}>
          {getTrialEndLabel(item.trialEndsAt, new Date())}
        </p>
      )}
    </div>
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

// ACTIVE → green/positive; TRIAL → amber/pending; SUSPENDED → red/destructive;
// CANCELLED ("Baja") → muted/terminal.
function StatusBadge({ status, testId }: { status: TenantStatus; testId: string }) {
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
        {getStatusLabel(status)}
      </Badge>
    );
  }

  if (status === 'TRIAL') {
    return (
      <Badge
        data-testid={testId}
        variant='outline'
        className={cn(
          'rounded-full border-transparent',
          'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
        )}
      >
        {getStatusLabel(status)}
      </Badge>
    );
  }

  if (status === 'SUSPENDED') {
    return (
      <Badge data-testid={testId} variant='destructive' className='rounded-full'>
        {getStatusLabel(status)}
      </Badge>
    );
  }

  // CANCELLED — terminal/muted.
  return (
    <Badge
      data-testid={testId}
      variant='outline'
      className='text-muted-foreground rounded-full border-transparent'
    >
      {getStatusLabel(status)}
    </Badge>
  );
}

// EMPRESA prominent → default; PROFESIONAL → secondary; BASICO muted → outline;
// null (unassigned) → muted "Sin plan".
function PlanBadge({ plan, testId }: { plan: TenantPlan | null; testId: string }) {
  if (plan === null) {
    return (
      <Badge
        data-testid={testId}
        variant='outline'
        className='text-muted-foreground rounded-full border-dashed'
      >
        Sin plan
      </Badge>
    );
  }

  const variant = plan === 'EMPRESA' ? 'default' : plan === 'PROFESIONAL' ? 'secondary' : 'outline';

  return (
    <Badge data-testid={testId} variant={variant} className='rounded-full'>
      {getPlanLabel(plan)}
    </Badge>
  );
}

// Compact, CONTAINED limits summary — a single truncated line
// (`10 usr · 50 pub · 1 GB`) with an explicit max-width. This replaces the old
// wide right-aligned `<dl>` (min-w-48 + justify-between) that was the source of
// the column bleed. `∞` denotes a null (unlimited) value; the full breakdown is
// available on hover via the `title` attribute.
function TenantLimitsSummary({ limits, testId }: { limits: TenantLimits; testId: string }) {
  const users = formatLimitCount(limits.maxUsers);
  const engagements = formatLimitCount(limits.maxActivePropertyEngagements);
  const storage = formatStorageLimit(limits.maxDocumentsStorageMb);

  const compact = `${users} usr · ${engagements} pub · ${storage}`;
  const full = [
    `Usuarios: ${users}`,
    `Publicaciones activas: ${engagements}`,
    `Storage documentos: ${storage}`
  ].join('\n');

  return (
    <span
      data-testid={testId}
      title={full}
      className='text-muted-foreground block max-w-[200px] truncate text-xs whitespace-nowrap'
    >
      {compact}
    </span>
  );
}

// Status may render an unexpected raw value gracefully rather than throwing
// (the server column is a raw string — D4/D14).
export function getStatusLabel(status: string) {
  const labels: Record<TenantStatus, string> = {
    TRIAL: 'Trial',
    ACTIVE: 'Activo',
    SUSPENDED: 'Suspendido',
    CANCELLED: 'Baja'
  };

  return labels[status as TenantStatus] ?? status;
}

// platform-manual-plans (Slice 4, Part 2) — D10: fixed catalog, static copy
// (no per-tenant translation needed — only 3 tiers exist).
export const PLAN_LABELS: Record<TenantPlan, string> = {
  BASICO: 'Básico',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa'
};

// Neutral placeholder ("—") for an unassigned plan, mirrors getTrialEndLabel's
// null-safe pattern. An unexpected raw value renders as-is rather than
// throwing (mirrors getStatusLabel — the server column is a raw string).
export function getPlanLabel(plan: string | null): string {
  if (plan === null) {
    return '—';
  }

  return PLAN_LABELS[plan as TenantPlan] ?? plan;
}

function formatLimitCount(value: number | null) {
  return value === null ? '∞' : formatNumber(value);
}

// MB below 1000 render as-is; 1000+ collapse to GB (÷1000 decimal, matching the
// plan catalog's intent — Profesional 5000 MB reads as "5 GB", not 4,9) with one
// decimal so the compact line stays short. null → ∞ (unlimited).
function formatStorageLimit(value: number | null) {
  if (value === null) {
    return '∞';
  }

  if (value >= 1000) {
    const gigabytes = Math.round((value / 1000) * 10) / 10;
    return `${formatNumber(gigabytes)} GB`;
  }

  return `${formatNumber(value)} MB`;
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

  const trialEndsAtMs = new Date(trialEndsAt).getTime();
  if (Number.isNaN(trialEndsAtMs)) {
    return '—';
  }

  const msRemaining = trialEndsAtMs - now.getTime();

  if (msRemaining <= 0) {
    return 'Trial vencido';
  }

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  return daysRemaining === 1 ? 'Vence en 1 día' : `Vence en ${daysRemaining} días`;
}
