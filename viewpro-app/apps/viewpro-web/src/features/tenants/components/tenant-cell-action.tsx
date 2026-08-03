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
import type { TenantListItem } from '@/features/tenants/api/types';
import { useRouter } from 'next/navigation';
import { getTenantActions, type TenantAction } from './tenants-table';

type Props = {
  item: TenantListItem;
  isMutating: boolean;
  onEditLimits: (item: TenantListItem) => void;
  onStatusAction: (item: TenantListItem, action: TenantAction) => void;
  onAssignPlan: (item: TenantListItem) => void;
  // platform-payment-ledger: opens the money ledger for this tenant. Lives on
  // the row because this is where the tenant's NAME exists — the detail page
  // only knows a short code, and the record dialog names the agency being
  // charged as its guard against recording against the wrong one.
  onOpenPayments: (item: TenantListItem) => void;
};

/**
 * Row actions dropdown for the tenants table (mirrors app-new's cell-action
 * pattern). Presentational only — it owns no mutations. The status actions come
 * from getTenantActions(item) (single source of truth): CANCELLED rows expose
 * zero status actions, so a CANCELLED row shows only "Editar límites". The
 * destructive cancel action is rendered with the destructive item variant.
 * Every item is disabled while a mutation is in flight (double-submit guard).
 */
export function TenantCellAction({
  item,
  isMutating,
  onEditLimits,
  onStatusAction,
  onAssignPlan,
  onOpenPayments
}: Props) {
  const router = useRouter();
  const actions = getTenantActions(item);

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
        <DropdownMenuItem onClick={() => router.push(`/dashboard/tenants/${item.id}`)}>
          Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isMutating} onClick={() => onEditLimits(item)}>
          Editar límites
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isMutating} onClick={() => onAssignPlan(item)}>
          Asignar plan
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isMutating} onClick={() => onOpenPayments(item)}>
          Pagos
        </DropdownMenuItem>
        {actions.map((action) => (
          <DropdownMenuItem
            key={action.kind}
            variant={action.kind === 'cancel' ? 'destructive' : 'default'}
            disabled={isMutating}
            onClick={() => onStatusAction(item, action)}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
