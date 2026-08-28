/**
 * T-19 — RED: StepUpDialog component tests (D11)
 * Spec: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
 *   (wrong-password scenario)
 *
 * Tests cover:
 *   - Renders a password field and submit button when `open`
 *   - Submitting calls onSubmit(password) with the entered value
 *   - isVerifying: true disables the submit button and gates Escape-to-close
 *   - Passing an `error` prop renders it inline (no toast, modal stays open)
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepUpDialog } from './step-up-dialog';

function noop() {
  // used as a default no-op handler where the test does not assert calls
}

describe('StepUpDialog', () => {
  it('is closed when open is false', () => {
    render(<StepUpDialog open={false} isVerifying={false} onSubmit={noop} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a password field and submit button when open', () => {
    render(<StepUpDialog open isVerifying={false} onSubmit={noop} />);

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    expect(screen.getByRole('button', { name: /confirmar/i })).toBeTruthy();
  });

  it('submitting calls onSubmit with the entered password', () => {
    const onSubmit = vi.fn();
    render(<StepUpDialog open isVerifying={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret1234' } });
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    expect(onSubmit).toHaveBeenCalledWith('secret1234');
  });

  it('isVerifying disables the submit button', () => {
    render(<StepUpDialog open isVerifying onSubmit={noop} />);

    expect(screen.getByRole('button', { name: /verificando/i })).toBeDisabled();
  });

  it('gates Escape-to-close while isVerifying', () => {
    const onOpenChange = vi.fn();
    render(<StepUpDialog open isVerifying onSubmit={noop} onOpenChange={onOpenChange} />);

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('renders the error prop inline (modal stays open, no toast)', () => {
    render(
      <StepUpDialog open isVerifying={false} onSubmit={noop} error='Contraseña incorrecta' />
    );

    expect(screen.getByText('Contraseña incorrecta')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders a Cancel button when open (JD)', () => {
    render(<StepUpDialog open isVerifying={false} onSubmit={noop} />);

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeTruthy();
  });

  it('clicking Cancel requests dismissal via onOpenChange(false) (JD)', () => {
    const onOpenChange = vi.fn();
    render(<StepUpDialog open isVerifying={false} onSubmit={noop} onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disables the Cancel button while isVerifying (JD)', () => {
    render(<StepUpDialog open isVerifying onSubmit={noop} />);

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});

describe('password visibility (#281)', () => {
  it('reveals the step-up password and keeps what was typed', () => {
    render(<StepUpDialog open isVerifying={false} onSubmit={noop} />);

    const input = screen.getByLabelText('Contraseña');
    fireEvent.change(input, { target: { value: 'secreto-123' } });
    expect(input).toHaveAttribute('type', 'password');

    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-controls', 'step-up-password');

    fireEvent.click(toggle);

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secreto-123');
    expect(screen.getByRole('button', { name: 'Ocultar contraseña' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});
