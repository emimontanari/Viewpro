import { Icons, type Icon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { AssignableProductAgent, ProductMovementType } from '@/features/products/api/types';
import { movementTypeLabels } from '@/features/products/constants/movement-options';
import { cn } from '@/lib/utils';
import type { ActivityKindFilter } from '../api/types';

const ALL_FILTERS_VALUE = 'all';

const movementTypeOptions = Object.entries(movementTypeLabels).map(([value, label]) => ({
  label,
  value: value as ProductMovementType
}));

const activityKindOptions: Array<{ icon: Icon; label: string; value: ActivityKindFilter }> = [
  { icon: Icons.grid, label: 'Todo', value: 'all' },
  { icon: Icons.listDetails, label: 'Movimientos', value: 'movement' },
  { icon: Icons.post, label: 'Documentos', value: 'document_request' }
];

export function ActivityFilters({
  assignableAgents,
  dateFrom,
  dateTo,
  hasFilters,
  isLoadingAgents,
  kind,
  sellerId,
  type,
  onClearFilters,
  onDateFromChange,
  onDateToChange,
  onKindChange,
  onSellerChange,
  onTypeChange
}: {
  assignableAgents: AssignableProductAgent[];
  dateFrom: string | null;
  dateTo: string | null;
  hasFilters: boolean;
  isLoadingAgents: boolean;
  kind: ActivityKindFilter;
  sellerId: string | null;
  type: ProductMovementType | undefined;
  onClearFilters: () => void;
  onDateFromChange: (value: string | null) => void;
  onDateToChange: (value: string | null) => void;
  onKindChange: (value: ActivityKindFilter) => void;
  onSellerChange: (value: string | null) => void;
  onTypeChange: (value: ProductMovementType | null) => void;
}) {
  const isDocumentOnly = kind === 'document_request';

  return (
    <Card className='py-0'>
      <CardContent className='space-y-4 p-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div>
            <h2 className='text-sm font-semibold'>Filtros</h2>
            <p className='text-sm text-muted-foreground'>
              Ajustá el seguimiento por actividad, responsable o fecha.
            </p>
          </div>
          {hasFilters ? (
            <Button type='button' variant='outline' size='sm' onClick={onClearFilters}>
              <Icons.refresh className='size-4' aria-hidden />
              Limpiar filtros
            </Button>
          ) : null}
        </div>

        <div className='flex w-full max-w-3xl flex-wrap gap-2 rounded-xl border bg-muted/20 p-1 lg:w-1/2'>
          {activityKindOptions.map((option) => {
            const isSelected = kind === option.value;
            const ActivityKindIcon = option.icon;

            return (
              <Button
                key={option.value}
                type='button'
                variant={isSelected ? 'default' : 'ghost'}
                size='sm'
                className={cn('min-w-28 flex-1 gap-2 rounded-lg', isSelected && 'shadow-xs')}
                aria-pressed={isSelected}
                onClick={() => onKindChange(option.value)}
              >
                <ActivityKindIcon className='size-4' aria-hidden />
                {option.label}
              </Button>
            );
          })}
        </div>

        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <div className='space-y-2'>
            <label htmlFor='activity-type-filter' className='text-sm font-medium'>
              Tipo de actualización
            </label>
            <Select
              disabled={isDocumentOnly}
              value={type ?? ALL_FILTERS_VALUE}
              onValueChange={(value) =>
                onTypeChange(value === ALL_FILTERS_VALUE ? null : (value as ProductMovementType))
              }
            >
              <SelectTrigger id='activity-type-filter' className='w-full'>
                <SelectValue placeholder='Todos los tipos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTERS_VALUE}>Todos los tipos</SelectItem>
                {movementTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isDocumentOnly ? (
              <p className='text-xs text-muted-foreground'>
                El tipo de actualización aplica sólo a movimientos.
              </p>
            ) : null}
          </div>

          <div className='space-y-2'>
            <label htmlFor='activity-seller-filter' className='text-sm font-medium'>
              Responsable
            </label>
            <Select
              disabled={isLoadingAgents || assignableAgents.length === 0}
              value={sellerId ?? ALL_FILTERS_VALUE}
              onValueChange={(value) => onSellerChange(value === ALL_FILTERS_VALUE ? null : value)}
            >
              <SelectTrigger id='activity-seller-filter' className='w-full'>
                <SelectValue
                  placeholder={isLoadingAgents ? 'Cargando responsables' : 'Todos los responsables'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTERS_VALUE}>Todos los responsables</SelectItem>
                {assignableAgents.map((agent) => (
                  <SelectItem key={agent.userId} value={agent.userId}>
                    {getAgentDisplayName(agent)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoadingAgents && assignableAgents.length === 0 ? (
              <p className='text-xs text-muted-foreground'>
                Todavía no hay responsables para filtrar.
              </p>
            ) : null}
          </div>

          <ActivityDateFilterInput
            id='activity-date-from'
            label='Desde'
            value={dateFrom}
            onChange={onDateFromChange}
          />

          <ActivityDateFilterInput
            id='activity-date-to'
            label='Hasta'
            value={dateTo}
            onChange={onDateToChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityDateFilterInput({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className='space-y-2'>
      <label htmlFor={id} className='text-sm font-medium'>
        {label}
      </label>
      <div className='relative'>
        <Icons.calendar className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          id={id}
          type='date'
          value={value ?? ''}
          className='h-10 pl-10 pr-3 text-left [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0'
          onChange={(event) => onChange(event.target.value || null)}
        />
      </div>
    </div>
  );
}

function getAgentDisplayName(agent: { email: string; firstName: string | null }) {
  return agent.firstName?.trim() || agent.email;
}
