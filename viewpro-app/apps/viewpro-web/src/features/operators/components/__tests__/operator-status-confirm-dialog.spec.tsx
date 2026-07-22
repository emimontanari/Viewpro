/**
 * platform-operator-management (A4, PR2) — RED: OperatorStatusConfirmDialog
 * tests. Shown only for the SUSPEND transition (mirrors
 * TenantStatusConfirmDialog's suspend variant) — REACTIVATE PATCHes directly
 * from the container without this dialog (same asymmetry as tenants' ACTIVATE
 * toggle).
 *
 * Tests cover:
 *   - open===Boolean(operator); renders the operator's email in the copy
 *   - Cancel button calls onCancel
 *   - Confirm button calls onConfirm
 *   - isPending disables both buttons and shows the pending label
 *   - Escape dismissal is a no-op while isPending
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { OperatorListItem } from '@/features/operators/api/types';
import { OperatorStatusConfirmDialog } from '../operator-status-confirm-dialog';

const OPERATOR: OperatorListItem = {
  id: 'op-1',
  email: 'ops@viewpro.app',
  role: 'OPERATIONS',
  status: 'ACTIVE',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

function renderDialog(overrides: Partial<React.ComponentProps<typeof OperatorStatusConfirmDialog>> = {}) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  const utils = render(
    <OperatorStatusConfirmDialog
      operator={OPERATOR}
      isPending={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
      {...overrides}
    />
  );
  return { ...utils, onCancel, onConfirm };
}

describe('OperatorStatusConfirmDialog — rendering', () => {
  it('renders as an alertdialog when operator is set', () => {
    renderDialog();

    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('does not render when operator is null', () => {
    renderDialog({ operator: null });

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it("renders the operator's email in the confirmation copy", () => {
    renderDialog();

    expect(screen.getByText(/ops@viewpro\.app/)).toBeTruthy();
  });
});

describe('OperatorStatusConfirmDialog — actions', () => {
  it('clicking the confirm button calls onConfirm', () => {
    const { onConfirm } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Suspender' }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('clicking cancel calls onCancel', () => {
    const { onCancel } = renderDialog();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('OperatorStatusConfirmDialog — pending gating', () => {
  it('isPending shows the pending label and disables the confirm button', () => {
    renderDialog({ isPending: true });

    const button = screen.getByRole('button', { name: 'Suspendiendo…' });
    expect(button).toBeDisabled();
  });

  it('isPending disables the cancel button too', () => {
    renderDialog({ isPending: true });

    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });

  it('Escape dismissal is a no-op while isPending', () => {
    const { onCancel } = renderDialog({ isPending: true });

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
  });
});
