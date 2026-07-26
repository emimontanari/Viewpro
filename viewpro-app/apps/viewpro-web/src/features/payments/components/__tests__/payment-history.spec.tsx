/**
 * platform-payment-ledger (PR 3) — RED: the payment history an operator reads.
 *
 * Two behaviors here are load-bearing rather than cosmetic:
 *
 * 1. A reversed payment is SHOWN, struck through and labelled with its reason.
 *    Hiding it would turn the console into a filtered view of the ledger, and
 *    an operator reconciling against a bank statement would never see that a
 *    payment had been cancelled — the exact thing the append-only design
 *    exists to make visible.
 *
 * 2. The reversal action is ABSENT for non-OWNER operators, not disabled.
 *    A greyed-out button advertises a capability and invites a workaround; the
 *    server enforces the rule either way, but the UI should not tempt.
 *
 * Spec: Payment History Endpoint, Reversal Corrects Without Erasing,
 *   Permission Separation for Money Operations.
 */

import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { Payment, TenantPayments } from '@/features/payments/api/types';
import { PaymentHistory } from '../payment-history';

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    tenantId: 'tenant-1',
    amountMinorUnits: '4500000',
    currency: 'ARS',
    method: 'BANK_TRANSFER',
    plan: 'PROFESIONAL',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-31',
    receiptReference: '8842-A',
    note: null,
    recordedByOperatorId: 'operator-1',
    recordedAt: '2026-08-01T12:00:00.000Z',
    reversalOfPaymentId: null,
    reversalReason: null,
    reversedByPaymentId: null,
    isReversed: false,
    ...overrides
  };
}

function data(overrides: Partial<TenantPayments> = {}): TenantPayments {
  return {
    paidThroughAt: '2026-08-31',
    overdueDays: null,
    payments: [payment()],
    ...overrides
  };
}

function noop() {
  // default no-op handler
}

describe('PaymentHistory', () => {
  it('renders the amount without losing precision', () => {
    render(
      <PaymentHistory
        data={data({ payments: [payment({ amountMinorUnits: '9007199254740993' })] })}
        canReverse={false}
        onReverse={noop}
      />
    );

    expect(screen.getByText('$ 90.071.992.547.409,93')).toBeTruthy();
  });

  it('shows the paid-through date', () => {
    render(<PaymentHistory data={data()} canReverse={false} onReverse={noop} />);

    expect(screen.getByText('Pago hasta el 31/08/2026')).toBeTruthy();
  });

  it('shows an overdue label when the period has lapsed', () => {
    render(
      <PaymentHistory
        data={data({ paidThroughAt: '2026-08-31', overdueDays: 3 })}
        canReverse={false}
        onReverse={noop}
      />
    );

    expect(screen.getByText('Vencido hace 3 días')).toBeTruthy();
  });

  it('says so when the tenant has no payments at all', () => {
    render(
      <PaymentHistory
        data={data({ paidThroughAt: null, overdueDays: null, payments: [] })}
        canReverse={false}
        onReverse={noop}
      />
    );

    expect(screen.getByText('Sin pagos registrados')).toBeTruthy();
  });

  it('shows a reversed payment rather than hiding it, with its reason', () => {
    render(
      <PaymentHistory
        data={data({
          payments: [
            payment({ isReversed: true, reversedByPaymentId: 'pay-2', reversalReason: null }),
            payment({
              id: 'pay-2',
              reversalOfPaymentId: 'pay-1',
              reversalReason: 'transferencia no recibida'
            })
          ]
        })}
        canReverse={false}
        onReverse={noop}
      />
    );

    expect(screen.getByText(/anulado/i)).toBeTruthy();
    expect(screen.getByText(/transferencia no recibida/)).toBeTruthy();
  });

  it('hides the reversal action entirely when the operator cannot reverse', () => {
    render(<PaymentHistory data={data()} canReverse={false} onReverse={noop} />);

    // Absent, not merely disabled: a greyed-out button advertises a capability
    // the operator does not have.
    expect(screen.queryByRole('button', { name: /anular/i })).toBeNull();
  });

  it('offers the reversal action to an operator who can reverse', () => {
    const onReverse = vi.fn();
    render(<PaymentHistory data={data()} canReverse onReverse={onReverse} />);

    expect(screen.getByRole('button', { name: /anular/i })).toBeTruthy();
  });

  it('does not offer to reverse an already-reversed payment', () => {
    render(
      <PaymentHistory
        data={data({ payments: [payment({ isReversed: true, reversedByPaymentId: 'pay-2' })] })}
        canReverse
        onReverse={noop}
      />
    );

    expect(screen.queryByRole('button', { name: /anular/i })).toBeNull();
  });

  it('does not offer to reverse a reversal row', () => {
    render(
      <PaymentHistory
        data={data({
          payments: [payment({ id: 'pay-2', reversalOfPaymentId: 'pay-1', reversalReason: 'error' })]
        })}
        canReverse
        onReverse={noop}
      />
    );

    expect(screen.queryByRole('button', { name: /anular/i })).toBeNull();
  });
});
