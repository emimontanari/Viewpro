/**
 * platform-manual-plans (Slice 4, Part 2) — RED: TenantPlanDialog component
 * tests.
 * Spec: Assign-plan action drives the existing limits control lane —
 *   Operator UI shows plan and fresh limits together; Neutral placeholder
 *   for unassigned plan.
 *
 * Tests cover:
 *   - Modal opens when `tenant` is set, closed when `tenant` is null
 *   - Tier picker renders the 3 catalog options (Básico/Profesional/Empresa)
 *   - Pre-selects the tenant's current plan when set; defaults to the first
 *     tier when the tenant has no plan assigned
 *   - Submitting emits onAssign with the selected tier
 *   - isSaving={true} disables the confirm button
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { TenantListItem } from '@/features/tenants/api/types';
import { TenantPlanDialog } from '../tenant-plan-dialog';

const TENANT: TenantListItem = {
  id: 'tenant-1',
  name: 'Acme Realty',
  slug: 'acme-realty',
  status: 'ACTIVE',
  limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
  trialEndsAt: null,
  plan: null
};

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

describe('TenantPlanDialog', () => {
  it('is closed when tenant is null', () => {
    render(<TenantPlanDialog tenant={null} isSaving={false} onClose={noop} onAssign={noop} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens when tenant is set', () => {
    render(<TenantPlanDialog tenant={TENANT} isSaving={false} onClose={noop} onAssign={noop} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders the 3 catalog tier options', () => {
    render(<TenantPlanDialog tenant={TENANT} isSaving={false} onClose={noop} onAssign={noop} />);

    const select = screen.getByLabelText('Plan') as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((option) => option.textContent);

    expect(optionLabels).toEqual(['Básico', 'Profesional', 'Empresa']);
  });

  it('pre-selects the tenant current plan when set', () => {
    render(
      <TenantPlanDialog
        tenant={{ ...TENANT, plan: 'PROFESIONAL' }}
        isSaving={false}
        onClose={noop}
        onAssign={noop}
      />
    );

    const select = screen.getByLabelText('Plan') as HTMLSelectElement;
    expect(select.value).toBe('PROFESIONAL');
  });

  it('defaults to the first tier (BASICO) when the tenant has no plan assigned', () => {
    render(<TenantPlanDialog tenant={TENANT} isSaving={false} onClose={noop} onAssign={noop} />);

    const select = screen.getByLabelText('Plan') as HTMLSelectElement;
    expect(select.value).toBe('BASICO');
  });

  it('submitting emits onAssign with the selected tier', () => {
    const onAssign = vi.fn();
    render(<TenantPlanDialog tenant={TENANT} isSaving={false} onClose={noop} onAssign={onAssign} />);

    fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'EMPRESA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Asignar plan' }));

    expect(onAssign).toHaveBeenCalledWith('EMPRESA');
  });

  it('isSaving={true} disables the confirm button', () => {
    render(<TenantPlanDialog tenant={TENANT} isSaving={true} onClose={noop} onAssign={noop} />);

    expect(screen.getByRole('button', { name: 'Asignando…' })).toBeDisabled();
  });
});
