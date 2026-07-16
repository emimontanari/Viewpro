/**
 * platform-operator-management (A4, PR2) — RED: OperatorCreateDialog tests.
 * Mirrors TenantPlanDialog's controlled-modal/form pattern (D6/D7 there).
 *
 * Tests cover:
 *   - Renders email input, role select (OWNER/OPERATIONS/ANALYST), temp
 *     password input, when `open`
 *   - Submitting emits onSubmit({email, role, tempPassword})
 *   - Default role is ANALYST (least-privilege)
 *   - `inlineError` renders "Ese email ya está registrado." when set
 *     (409 DUPLICATE_EMAIL, mapped by the container)
 *   - Gates Escape/X-icon dismissal while `isSaving`
 *   - isSaving disables the submit button and shows the pending label
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { OperatorCreateDialog } from '../operator-create-dialog';

function renderDialog(overrides: Partial<React.ComponentProps<typeof OperatorCreateDialog>> = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <OperatorCreateDialog
      open={true}
      isSaving={false}
      inlineError={null}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />
  );
  return { ...utils, onClose, onSubmit };
}

describe('OperatorCreateDialog — rendering', () => {
  it('renders when open, with email/role/temp-password fields', () => {
    renderDialog();

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Rol')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña temporal')).toBeTruthy();
  });

  it('does not render when closed', () => {
    renderDialog({ open: false });

    expect(screen.queryByLabelText('Email')).toBeNull();
  });

  it('defaults the role select to ANALYST (least-privilege)', () => {
    renderDialog();

    expect(screen.getByLabelText('Rol')).toHaveValue('ANALYST');
  });
});

describe('OperatorCreateDialog — submit', () => {
  it('submits {email, role, tempPassword} from the form fields', () => {
    const { onSubmit } = renderDialog();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@viewpro.app' } });
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'OPERATIONS' } });
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), {
      target: { value: 'a-strong-temp-pw12' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'new@viewpro.app',
      role: 'OPERATIONS',
      tempPassword: 'a-strong-temp-pw12'
    });
  });

  it('submits with the default ANALYST role when the select is untouched (triangulation)', () => {
    const { onSubmit } = renderDialog();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner2@viewpro.app' } });
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), {
      target: { value: 'another-temp-pw12' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'owner2@viewpro.app',
      role: 'ANALYST',
      tempPassword: 'another-temp-pw12'
    });
  });
});

describe('OperatorCreateDialog — inline 409 error', () => {
  it('renders the duplicate-email message when inlineError is set', () => {
    renderDialog({ inlineError: 'Ese email ya está registrado.' });

    expect(screen.getByText('Ese email ya está registrado.')).toBeTruthy();
  });

  it('renders no inline error when inlineError is null', () => {
    renderDialog({ inlineError: null });

    expect(screen.queryByText('Ese email ya está registrado.')).toBeNull();
  });
});

describe('OperatorCreateDialog — pending/dismiss gating', () => {
  it('isSaving disables the submit button and shows the pending label', () => {
    renderDialog({ isSaving: true });

    const button = screen.getByRole('button', { name: 'Creando…' });
    expect(button).toBeDisabled();
  });

  it('Escape/X-icon dismissal is a no-op while isSaving', () => {
    const { onClose } = renderDialog({ isSaving: true });

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancel button calls onClose when not saving', () => {
    const { onClose } = renderDialog({ isSaving: false });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
