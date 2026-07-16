'use client';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import type { OperatorListItem } from '@/features/operators/api/types';
import { getOperatorStatusAction, type OperatorStatusAction } from './operators-table';

type Props = {
  item: OperatorListItem;
  isMutating: boolean;
  onChangeRole: (item: OperatorListItem) => void;
  onStatusAction: (item: OperatorListItem, action: OperatorStatusAction) => void;
};

/**
 * Row actions dropdown for the operators table (mirrors TenantCellAction).
 * Presentational only — owns no mutations. The status action comes from
 * getOperatorStatusAction(item) (single source of truth): ACTIVE → offer
 * "Suspender", SUSPENDED → offer "Reactivar". Every item is disabled while a
 * mutation is in flight (double-submit guard).
 */
export function OperatorCellAction({ item, isMutating, onChangeRole, onStatusAction }: Props) {
  const statusAction = getOperatorStatusAction(item);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon'>
          <span className='sr-only'>Abrir menú</span>
          <Icons.ellipsis className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem disabled={isMutating} onClick={() => onChangeRole(item)}>
          Cambiar rol
        </DropdownMenuItem>
        <DropdownMenuItem
          variant={statusAction.targetStatus === 'SUSPENDED' ? 'destructive' : 'default'}
          disabled={isMutating}
          onClick={() => onStatusAction(item, statusAction)}
        >
          {statusAction.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
