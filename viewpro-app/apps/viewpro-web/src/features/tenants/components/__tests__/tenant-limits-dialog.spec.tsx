/**
 * T-14 — RED: TenantLimitsDialog component tests
 * Spec: Limits Editing via Modal Dialog (all 3 scenarios)
 *
 * Tests cover:
 *   - Modal opens pre-filled with the 3 current values when `tenant` is set
 *   - Modal is closed when `tenant` is null
 *   - Clicking "Sin límite" clears a field to empty string
 *   - Submitting emits onSave with the parsed payload (empty→null, numeric string→Number)
 *   - isSaving={true} disables the save button
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import type { TenantListItem } from '@/features/tenants/api/types';
import { TenantLimitsDialog } from '../tenant-limits-dialog';

const TENANT: TenantListItem = {
  id: 'tenant-1',
  name: 'Acme Realty',
  slug: 'acme-realty',
  status: 'ACTIVE',
  limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
  trialEndsAt: null
};

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

describe('TenantLimitsDialog', () => {
  it('is closed when tenant is null', () => {
    render(<TenantLimitsDialog tenant={null} isSaving={false} onClose={noop} onSave={noop} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens pre-filled with the 3 current values when tenant is set', () => {
    render(<TenantLimitsDialog tenant={TENANT} isSaving={false} onClose={noop} onSave={noop} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Usuarios')).toHaveValue(10);
    expect(screen.getByLabelText('Publicaciones activas')).toHaveValue(50);
    expect(screen.getByLabelText('Storage documentos (MB)')).toHaveValue(1024);
  });

  it('shows empty fields for null limit values', () => {
    const unlimited: TenantListItem = {
      ...TENANT,
      limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
    };

    render(<TenantLimitsDialog tenant={unlimited} isSaving={false} onClose={noop} onSave={noop} />);

    expect(screen.getByLabelText('Usuarios')).toHaveValue(null);
    expect(screen.getByLabelText('Publicaciones activas')).toHaveValue(null);
    expect(screen.getByLabelText('Storage documentos (MB)')).toHaveValue(null);
  });

  it('clicking "Sin límite" on a field clears it to empty string', () => {
    render(<TenantLimitsDialog tenant={TENANT} isSaving={false} onClose={noop} onSave={noop} />);

    const clearButtons = screen.getAllByRole('button', { name: 'Sin límite' });
    // First "Sin límite" button belongs to the "Usuarios" field (D6 field order).
    fireEvent.click(clearButtons[0]);

    expect(screen.getByLabelText('Usuarios')).toHaveValue(null);
  });

  it('submitting emits onSave with the parsed payload — empty field → null, numeric string → Number', () => {
    const onSave = vi.fn();
    render(<TenantLimitsDialog tenant={TENANT} isSaving={false} onClose={noop} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText('Usuarios'), { target: { value: '25' } });
    const clearButtons = screen.getAllByRole('button', { name: 'Sin límite' });
    // Third field ("Storage documentos (MB)") is cleared to null.
    fireEvent.click(clearButtons[2]);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar límites' }));

    expect(onSave).toHaveBeenCalledWith({
      maxUsers: 25,
      maxActivePropertyEngagements: 50,
      maxDocumentsStorageMb: null
    });
  });

  it('isSaving={true} disables the save button', () => {
    render(<TenantLimitsDialog tenant={TENANT} isSaving={true} onClose={noop} onSave={noop} />);

    expect(screen.getByRole('button', { name: /guardando límites/i })).toBeDisabled();
  });

  it('does not close on Escape while isSaving={true}', () => {
    const onClose = vi.fn();
    render(<TenantLimitsDialog tenant={TENANT} isSaving={true} onClose={onClose} onSave={noop} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape when not saving', () => {
    const onClose = vi.fn();
    render(<TenantLimitsDialog tenant={TENANT} isSaving={false} onClose={onClose} onSave={noop} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('re-seeds the form when the tenant prop changes', () => {
    const { rerender } = render(
      <TenantLimitsDialog tenant={TENANT} isSaving={false} onClose={noop} onSave={noop} />
    );

    expect(screen.getByLabelText('Usuarios')).toHaveValue(10);

    const otherTenant: TenantListItem = {
      ...TENANT,
      id: 'tenant-2',
      limits: { maxUsers: 5, maxActivePropertyEngagements: 5, maxDocumentsStorageMb: 5 }
    };

    rerender(<TenantLimitsDialog tenant={otherTenant} isSaving={false} onClose={noop} onSave={noop} />);

    expect(screen.getByLabelText('Usuarios')).toHaveValue(5);
  });
});
