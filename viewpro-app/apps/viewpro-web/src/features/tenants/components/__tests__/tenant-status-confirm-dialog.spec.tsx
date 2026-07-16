/**
 * TenantStatusConfirmDialog component tests
 * Spec: Status Toggle with Suspend Confirmation — dismissal is gated while the
 * PATCH is in flight (isPending), so Escape cannot hide the "Suspendiendo…"
 * progress underneath an active mutation.
 * T-18 — RED: variant='cancel' — distinct, permanent/destructive confirmation
 * copy (D7), sharing the same pending/Escape gating as variant='suspend'.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { TenantListItem } from '@/features/tenants/api/types';
import { TenantStatusConfirmDialog } from '../tenant-status-confirm-dialog';

const TENANT: TenantListItem = {
  id: 'tenant-1',
  name: 'Acme Realty',
  slug: 'acme-realty',
  status: 'ACTIVE',
  limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 }
};

function noop() {
  // default no-op handler where the test does not assert calls
}

describe('TenantStatusConfirmDialog', () => {
  it('is closed when tenant is null', () => {
    render(
      <TenantStatusConfirmDialog
        tenant={null}
        isPending={false}
        onCancel={noop}
        onConfirm={noop}
      />
    );

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('opens with the tenant name when tenant is set', () => {
    render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={false}
        onCancel={noop}
        onConfirm={noop}
      />
    );

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/Acme Realty/)).toBeTruthy();
  });

  it('isPending={true} disables the confirm button', () => {
    render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={true}
        onCancel={noop}
        onConfirm={noop}
      />
    );

    expect(screen.getByRole('button', { name: /suspendiendo/i })).toBeDisabled();
  });

  it('does not cancel on Escape while isPending={true}', () => {
    const onCancel = vi.fn();
    render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={true}
        onCancel={onCancel}
        onConfirm={noop}
      />
    );

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels on Escape when not pending', () => {
    const onCancel = vi.fn();
    render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={false}
        onCancel={onCancel}
        onConfirm={noop}
      />
    );

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('TenantStatusConfirmDialog — variant="cancel" (T-18/D7)', () => {
  it('shows permanent/destructive framing distinct from the suspend copy', () => {
    render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={false}
        variant='cancel'
        onCancel={noop}
        onConfirm={noop}
      />
    );

    expect(screen.getByText('Cancelar inmobiliaria definitivamente')).toBeTruthy();
    expect(screen.getByText(/no se puede deshacer/i)).toBeTruthy();
    expect(screen.queryByText('Suspender inmobiliaria')).toBeNull();
  });

  it('confirm button is labeled "Cancelar definitivamente" (pending: "Cancelando…")', () => {
    const { rerender } = render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={false}
        variant='cancel'
        onCancel={noop}
        onConfirm={noop}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancelar definitivamente' })).toBeTruthy();

    rerender(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={true}
        variant='cancel'
        onCancel={noop}
        onConfirm={noop}
      />
    );

    expect(screen.getByRole('button', { name: /cancelando/i })).toBeDisabled();
  });

  it('does not cancel on Escape while isPending={true}, same gating as variant="suspend"', () => {
    const onCancel = vi.fn();
    render(
      <TenantStatusConfirmDialog
        tenant={TENANT}
        isPending={true}
        variant='cancel'
        onCancel={onCancel}
        onConfirm={noop}
      />
    );

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', code: 'Escape' });

    expect(onCancel).not.toHaveBeenCalled();
  });
});
