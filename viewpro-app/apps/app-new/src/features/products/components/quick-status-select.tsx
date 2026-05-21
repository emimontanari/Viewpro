'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { productKeys } from '../api/queries';
import { updateProductStatus } from '../api/service';
import type { Product, PropertyEngagementStatus } from '../api/types';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PROPERTY_STATUS_OPTIONS } from './product-tables/options';
import { getStatusLabel, getStatusTone } from './product-tables/columns';

export function QuickStatusSelect({
  className,
  propertyEngagement,
  size = 'default'
}: {
  className?: string;
  propertyEngagement: Product;
  size?: 'default' | 'compact';
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (status: PropertyEngagementStatus) =>
      updateProductStatus(propertyEngagement.id, {
        previousStatus: propertyEngagement.status,
        status
      }),
    onSuccess: async (_response, nextStatus) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(`Estado cambiado a ${getStatusLabel(nextStatus)}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado');
    }
  });

  function handleStatusChange(value: string) {
    const nextStatus = value as PropertyEngagementStatus;

    if (nextStatus === propertyEngagement.status || mutation.isPending) {
      return;
    }

    mutation.mutate(nextStatus);
  }

  const compact = size === 'compact';
  const displayStatus =
    mutation.isPending && mutation.variables ? mutation.variables : propertyEngagement.status;

  return (
    <Select value={displayStatus} disabled={mutation.isPending} onValueChange={handleStatusChange}>
      <SelectTrigger
        size='sm'
        aria-label={`Cambiar estado de ${propertyEngagement.property.title}`}
        className={cn(
          'h-8 min-h-0 gap-2 rounded-md border px-2.5 py-1 text-xs font-medium shadow-xs focus:ring-2 focus:ring-ring/30',
          compact ? 'w-full max-w-52' : 'w-full min-w-44 max-w-60',
          getStatusTone(displayStatus),
          mutation.isPending && 'opacity-70',
          className
        )}
      >
        <SelectValue aria-label={getStatusLabel(displayStatus)}>
          {getStatusLabel(displayStatus)}
        </SelectValue>
        {mutation.isPending ? (
          <span className='ml-auto text-[10px] opacity-75'>Guardando</span>
        ) : null}
      </SelectTrigger>
      <SelectContent align='end'>
        {PROPERTY_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
