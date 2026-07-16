'use client';

// platform-manual-plans (Slice 4, Part 2) — tier picker + confirm, mirroring
// TenantLimitsDialog's modal/form pattern (D6/D7): a raw useState<TenantPlan>
// form, seeded from `tenant.plan` on open via `useEffect([tenant])`. There is
// no single-tenant GET, so the row's data is the only source of truth.
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
import type { TenantListItem, TenantPlan } from '@/features/tenants/api/types';
import { PLAN_LABELS } from './tenants-table';

type Props = {
  tenant: TenantListItem | null;
  isSaving: boolean;
  onClose: () => void;
  onAssign: (plan: TenantPlan) => void;
};

const DEFAULT_PLAN: TenantPlan = 'BASICO';
const PLAN_OPTIONS: TenantPlan[] = ['BASICO', 'PROFESIONAL', 'EMPRESA'];

/**
 * Modal dialog to assign one of the 3 fixed catalog tiers (D10) to a tenant.
 * Seeded from `tenant.plan` on open — defaults to BASICO when the tenant has
 * no plan assigned yet.
 */
export function TenantPlanDialog({ tenant, isSaving, onClose, onAssign }: Props) {
  const [selectedPlan, setSelectedPlan] = React.useState<TenantPlan>(DEFAULT_PLAN);

  React.useEffect(() => {
    if (!tenant) {
      return;
    }

    setSelectedPlan(tenant.plan ?? DEFAULT_PLAN);
  }, [tenant]);

  return (
    <Dialog
      open={Boolean(tenant)}
      onOpenChange={(open) => {
        // Gate X-icon/Escape dismissal while the PATCH is in flight so the
        // "Asignando…" progress cannot be hidden mid-mutation.
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar plan{tenant ? ` a ${tenant.name}` : ''}</DialogTitle>
          <DialogDescription>
            Elegí un plan para aplicar sus límites preestablecidos a esta inmobiliaria.
          </DialogDescription>
        </DialogHeader>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            onAssign(selectedPlan);
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='plan'>Plan</Label>
            <select
              id='plan'
              aria-label='Plan'
              className='border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm'
              value={selectedPlan}
              onChange={(event) => setSelectedPlan(event.target.value as TenantPlan)}
            >
              {PLAN_OPTIONS.map((plan) => (
                <option key={plan} value={plan}>
                  {PLAN_LABELS[plan]}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Asignando…' : 'Asignar plan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
