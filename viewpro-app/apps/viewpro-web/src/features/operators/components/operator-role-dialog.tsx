'use client';

// Modal dialog to change an existing operator's role. Mirrors
// TenantPlanDialog's tier-picker/confirm pattern (D6/D7 there): a raw
// useState<OperatorRole> form, seeded from `operator.role` on open via
// `useEffect([operator])`. The container's onError maps a 422
// SELF_DEMOTE_FORBIDDEN/LAST_OWNER_PROTECTED guardrail to a toast — this
// dialog stays open/pending until the mutation settles (same Escape-gating
// as TenantLimitsDialog/TenantPlanDialog).
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { OperatorListItem, OperatorRole } from '@/features/operators/api/types';

type Props = {
  operator: OperatorListItem | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (role: OperatorRole) => void;
};

const ROLE_OPTIONS: { value: OperatorRole; label: string }[] = [
  { value: 'OWNER', label: 'Dueño' },
  { value: 'OPERATIONS', label: 'Operaciones' },
  { value: 'ANALYST', label: 'Analista' }
];

export function OperatorRoleDialog({ operator, isSaving, onClose, onSubmit }: Props) {
  const [selectedRole, setSelectedRole] = React.useState<OperatorRole>('ANALYST');

  React.useEffect(() => {
    if (!operator) {
      return;
    }

    setSelectedRole(operator.role);
  }, [operator]);

  return (
    <Dialog
      open={Boolean(operator)}
      onOpenChange={(open) => {
        // Gate X-icon/Escape dismissal while the PATCH is in flight so the
        // "Guardando…" progress cannot be hidden mid-mutation.
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cambiar rol{operator ? ` de ${operator.email}` : ''}</DialogTitle>
          <DialogDescription>Elegí el nuevo rol para este operador.</DialogDescription>
        </DialogHeader>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(selectedRole);
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='operator-new-role'>Rol</Label>
            <select
              id='operator-new-role'
              aria-label='Rol'
              className='border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm'
              disabled={isSaving}
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as OperatorRole)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar rol'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
