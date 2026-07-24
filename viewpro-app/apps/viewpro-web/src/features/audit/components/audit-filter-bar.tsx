'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { AuditFilterValues } from './audit-filters';
import { sourceLabel } from './audit-identity';
import { AUDIT_ACTION_OPTIONS } from './render-value';

type Props = {
  values: AuditFilterValues;
  onChange: (patch: Partial<AuditFilterValues>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
};

const ALL_VALUE = 'all';
const SOURCE_OPTIONS = ['INMOVIEW_OUTBOX', 'VIEWPRO_NATIVE'] as const;

/**
 * Server-driven filter bar for the global audit feed (design D10, spec
 * "Server-driven filter bar" requirement): action/source selects, tenantId/
 * actorId text inputs, a dateFrom/dateTo range, and a clear-filters
 * affordance.
 *
 * Fully CONTROLLED and framework-agnostic re: state ownership — filter
 * STATE lives in AuditFeedPage via nuqs (design D9); this component only
 * mirrors the current values and reports changes upward via onChange/
 * onClear. Kept deliberately dumb so it's testable without a nuqs adapter.
 */
export function AuditFilterBar({ values, onChange, onClear, hasActiveFilters }: Props) {
  return (
    <div className='flex flex-wrap items-end gap-3'>
      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='audit-filter-action'>Acción</Label>
        <Select
          value={values.action || ALL_VALUE}
          onValueChange={(value) => onChange({ action: value === ALL_VALUE ? '' : value })}
        >
          <SelectTrigger id='audit-filter-action' aria-label='Acción' className='w-[220px]'>
            <SelectValue placeholder='Todas las acciones' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todas las acciones</SelectItem>
            {AUDIT_ACTION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='audit-filter-source'>Origen</Label>
        <Select
          value={values.source || ALL_VALUE}
          onValueChange={(value) => onChange({ source: value === ALL_VALUE ? '' : value })}
        >
          <SelectTrigger id='audit-filter-source' aria-label='Origen' className='w-[160px]'>
            <SelectValue placeholder='Todos los orígenes' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Todos los orígenes</SelectItem>
            {SOURCE_OPTIONS.map((source) => (
              <SelectItem key={source} value={source}>
                {sourceLabel(source)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='audit-filter-tenant'>Inmobiliaria (ID)</Label>
        <Input
          id='audit-filter-tenant'
          value={values.tenantId}
          placeholder='tenant-id'
          className='w-[180px]'
          onChange={(event) => onChange({ tenantId: event.target.value })}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='audit-filter-actor'>Operador/usuario (ID)</Label>
        <Input
          id='audit-filter-actor'
          value={values.actorId}
          placeholder='actor-id'
          className='w-[180px]'
          onChange={(event) => onChange({ actorId: event.target.value })}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='audit-filter-date-from'>Desde</Label>
        <Input
          id='audit-filter-date-from'
          type='date'
          value={values.dateFrom}
          className='w-[160px]'
          onChange={(event) => onChange({ dateFrom: event.target.value })}
        />
      </div>

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor='audit-filter-date-to'>Hasta</Label>
        <Input
          id='audit-filter-date-to'
          type='date'
          value={values.dateTo}
          className='w-[160px]'
          onChange={(event) => onChange({ dateTo: event.target.value })}
        />
        {/* Date-range boundary decision — see audit-filters.ts's
           toExclusiveDateTo header comment for why this is needed. */}
        <p className='text-muted-foreground text-xs'>Incluye todo el día seleccionado.</p>
      </div>

      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={!hasActiveFilters}
        onClick={onClear}
      >
        <Icons.close />
        Limpiar filtros
      </Button>
    </div>
  );
}
