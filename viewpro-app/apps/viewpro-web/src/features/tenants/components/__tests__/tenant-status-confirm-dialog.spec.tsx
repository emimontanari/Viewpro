/**
 * TenantStatusConfirmDialog component tests
 * Spec: Status Toggle with Suspend Confirmation — dismissal is gated while the
 * PATCH is in flight (isPending), so Escape cannot hide the "Suspendiendo…"
 * progress underneath an active mutation.
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
