import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

type SelectOption = { value: string; label: string };

export function PropertyTableSummary({
  hasFilters,
  total,
  visibleCount
}: {
  hasFilters: boolean;
  total: number;
  visibleCount: number;
}) {
  if (total === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        {hasFilters
          ? 'No encontramos propiedades con esos filtros.'
          : 'Todavía no hay propiedades cargadas.'}
      </p>
    );
  }

  const resultLabel = total === 1 ? 'gestión inmobiliaria' : 'gestiones inmobiliarias';
  const filterContext = hasFilters ? 'con filtros' : 'en total';

  return (
    <p className='text-sm text-muted-foreground'>
      {total} {resultLabel} {filterContext} · {visibleCount} en esta vista
    </p>
  );
}

export function ActiveFilterSummary({
  archiveLabel,
  operationLabel,
  statusLabel,
  onClearFilters
}: {
  archiveLabel?: string;
  operationLabel?: string;
  statusLabel?: string;
  onClearFilters: () => void;
}) {
  return (
    <div className='flex flex-col gap-2 rounded-xl border bg-background/70 p-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='font-medium text-foreground'>Vista filtrada</span>
        {operationLabel ? <FilterBadge label='Operación' value={operationLabel} /> : null}
        {statusLabel ? <FilterBadge label='Estado' value={statusLabel} /> : null}
        {archiveLabel ? <FilterBadge label='Archivo' value={archiveLabel} /> : null}
      </div>
      <Button variant='ghost' size='sm' onClick={onClearFilters} className='h-7 w-fit px-2 text-xs'>
        Ver todo el inventario
      </Button>
    </div>
  );
}

function FilterBadge({ label, value }: { label: string; value: string }) {
  return (
    <Badge variant='outline' className='rounded-full bg-background text-foreground'>
      {label}: {value}
    </Badge>
  );
}

export function FilterSelect({
  allLabel,
  allValue,
  label,
  value,
  options,
  onValueChange
}: {
  allLabel: string;
  allValue: string;
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size='sm' aria-label={label} className='w-full sm:w-[176px]'>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent align='end'>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ArchiveFilterSelect({
  value,
  options,
  onValueChange
}: {
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger size='sm' aria-label='Archivo' className='w-full sm:w-[150px]'>
        <SelectValue placeholder='Archivo' />
      </SelectTrigger>
      <SelectContent align='end'>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PageSizeSelect({
  pageSize,
  options,
  onValueChange
}: {
  pageSize: number;
  options: number[];
  onValueChange: (pageSize: string) => void;
}) {
  return (
    <Select value={String(pageSize)} onValueChange={onValueChange}>
      <SelectTrigger size='sm' className='w-full sm:w-[112px]'>
        <SelectValue aria-label={`${pageSize} por página`} />
      </SelectTrigger>
      <SelectContent align='end'>
        {options.map((option) => (
          <SelectItem key={option} value={String(option)}>
            {option} / pág.
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
