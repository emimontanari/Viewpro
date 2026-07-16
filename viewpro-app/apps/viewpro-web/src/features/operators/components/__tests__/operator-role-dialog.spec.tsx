/**
 * platform-operator-management (A4, PR2) — RED: OperatorRoleDialog tests.
 * Mirrors TenantPlanDialog's tier-picker/confirm pattern — seeded from the
 * operator's current role on open.
 *
 * Tests cover:
 *   - Renders open===Boolean(operator); seeds the select from operator.role
 *   - Submitting emits onSubmit(selectedRole)
 *   - Changing the select then submitting emits the NEW role, not the seed
 *   - Gates Escape/X-icon dismissal while isSaving
 *   - isSaving disables submit and shows the pending label
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { OperatorListItem } from '@/features/operators/api/types';
import { OperatorRoleDialog } from '../operator-role-dialog';

const OPERATOR: OperatorListItem = {
  id: 'op-1',
  email: 'analyst@viewpro.app',
  role: 'ANALYST',
  status: 'ACTIVE',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof OperatorRoleDialog>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <OperatorRoleDialog
      operator={OPERATOR}
      isSaving={false}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...utils, onClose, onSubmit };
}

describe('OperatorRoleDialog — rendering', () => {
  it('renders when operator is set', () => {
    renderDialog();

    expect(screen.getByLabelText('Rol')).toBeTruthy();
  });

  it('does not render when operator is null', () => {
    renderDialog({ operator: null });

    expect(screen.queryByLabelText('Rol')).toBeNull();
  });

  it('seeds the select from operator.role', () => {
    renderDialog();

    expect(screen.getByLabelText('Rol')).toHaveValue('ANALYST');
  });

  it('re-seeds from a different operator.role (triangulation)', () => {
    renderDialog({ operator: { ...OPERATOR, role: 'OWNER' } });

    expect(screen.getByLabelText('Rol')).toHaveValue('OWNER');
  });
});

describe('OperatorRoleDialog — submit', () => {
  it('submits the seeded role when unchanged', () => {
    const { onSubmit } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));

    expect(onSubmit).toHaveBeenCalledWith('ANALYST');
  });

  it('submits the NEW role after changing the select', () => {
    const { onSubmit } = renderDialog();

    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'OPERATIONS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));

    expect(onSubmit).toHaveBeenCalledWith('OPERATIONS');
  });
});

describe('OperatorRoleDialog — pending/dismiss gating', () => {
  it('isSaving disables submit and shows the pending label', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  });

  it('Escape dismissal is a no-op while isSaving', () => {
    const { onClose } = renderDialog({ isSaving: true });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});
