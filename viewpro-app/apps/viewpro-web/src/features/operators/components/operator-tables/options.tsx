/**
 * Faceted-filter option lists for the operators DataTable toolbar (mirrors
 * app-new's product-tables/options.tsx). The `value`s are the raw server enum
 * values (OperatorRole / OperatorStatus); the `label`s are the Spanish console
 * copy shown in the faceted-filter popover.
 */
import type { Option } from '@/types/data-table';

export const ROLE_OPTIONS: Option[] = [
  { label: 'Dueño', value: 'OWNER' },
  { label: 'Operaciones', value: 'OPERATIONS' },
  { label: 'Analista', value: 'ANALYST' }
];

export const STATUS_OPTIONS: Option[] = [
  { label: 'Activo', value: 'ACTIVE' },
  { label: 'Suspendido', value: 'SUSPENDED' }
];
