/**
 * platform-payment-ledger (PR 3) — RED: the record-payment form.
 *
 * The assertion that matters most is the tenant NAME being visible before
 * submitting. Recording against the wrong agency is the mistake this form
 * makes easiest and the ledger makes hardest to undo — the fix is a reversal
 * both rows keep forever. Naming the tenant in front of the operator costs
 * nothing and prevents the one error with no clean correction.
 *
 * Spec: Record a Payment, Amounts Are Integer Minor Units.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { RecordPaymentDialog } from '../record-payment-dialog';

const TENANT = { id: 'tenant-1', name: 'Inmobiliaria Acme', plan: 'PROFESIONAL' };

function noop() {
  // default no-op handler
}

function fill(values: { amount?: string; from?: string; to?: string }) {
  if (values.amount !== undefined) {
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: values.amount } });
  }
  if (values.from !== undefined) {
    fireEvent.change(screen.getByLabelText('Período desde'), { target: { value: values.from } });
  }
  if (values.to !== undefined) {
    fireEvent.change(screen.getByLabelText('Período hasta'), { target: { value: values.to } });
  }
}

describe('RecordPaymentDialog', () => {
  it('is closed when no tenant is selected', () => {
    render(<RecordPaymentDialog tenant={null} isSaving={false} onClose={noop} onRecord={noop} />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('names the tenant being charged before the operator submits', () => {
    render(<RecordPaymentDialog tenant={TENANT} isSaving={false} onClose={noop} onRecord={noop} />);

    expect(screen.getByText('Inmobiliaria Acme')).toBeTruthy();
  });

  it('warns that the entry cannot be edited or deleted', () => {
    render(<RecordPaymentDialog tenant={TENANT} isSaving={false} onClose={noop} onRecord={noop} />);

    expect(screen.getByText(/no se puede editar ni borrar/i)).toBeTruthy();
  });

  it('submits the amount converted to minor units, not as typed', () => {
    const onRecord = vi.fn();
    render(
      <RecordPaymentDialog tenant={TENANT} isSaving={false} onClose={noop} onRecord={onRecord} />
    );

    fill({ amount: '45000,50', from: '2026-08-01', to: '2026-08-31' });
    fireEvent.click(screen.getByRole('button', { name: /registrar pago/i }));

    expect(onRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinorUnits: '4500050',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31'
      })
    );
  });

  it('rejects an invalid amount inline without submitting', () => {
    const onRecord = vi.fn();
    render(
      <RecordPaymentDialog tenant={TENANT} isSaving={false} onClose={noop} onRecord={onRecord} />
    );

    fill({ amount: '45000.567', from: '2026-08-01', to: '2026-08-31' });
    fireEvent.click(screen.getByRole('button', { name: /registrar pago/i }));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('rejects an inverted period inline without submitting', () => {
    const onRecord = vi.fn();
    render(
      <RecordPaymentDialog tenant={TENANT} isSaving={false} onClose={noop} onRecord={onRecord} />
    );

    fill({ amount: '45000', from: '2026-08-31', to: '2026-08-01' });
    fireEvent.click(screen.getByRole('button', { name: /registrar pago/i }));

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onRecord).not.toHaveBeenCalled();
  });

  it('seeds the plan from the tenant', () => {
    render(<RecordPaymentDialog tenant={TENANT} isSaving={false} onClose={noop} onRecord={noop} />);

    expect((screen.getByLabelText('Plan') as HTMLSelectElement).value).toBe('PROFESIONAL');
  });

  it('disables submission while saving', () => {
    render(<RecordPaymentDialog tenant={TENANT} isSaving onClose={noop} onRecord={noop} />);

    expect((screen.getByRole('button', { name: /registrando/i }) as HTMLButtonElement).disabled).toBe(
      true
    );
  });
});
