'use client';

import * as React from 'react';
import type { Payment, TenantPayments } from '@/features/payments/api/types';
import { formatAmount, overdueLabel, paidThroughLabel } from './money-format';

const METHOD_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Transferencia',
  CASH: 'Efectivo',
  MERCADOPAGO_LINK: 'Mercado Pago',
  OTHER: 'Otro'
};

interface PaymentHistoryProps {
  data: TenantPayments;
  /** OWNER-only. When false the reversal action is not rendered at all. */
  canReverse: boolean;
  onReverse: (payment: Payment) => void;
}

/**
 * PaymentHistory — the ledger as an operator reads it.
 *
 * Reversed payments are shown struck through with their reason, never hidden.
 * Hiding them would make the console a filtered view of the ledger, and an
 * operator reconciling against a bank statement would never see that a payment
 * had been cancelled — precisely what the append-only design exists to expose.
 *
 * The reversal action is omitted rather than disabled for operators who lack
 * the permission. The server enforces it either way; a greyed-out button just
 * advertises a capability and invites someone to look for a way around it.
 */
export function PaymentHistory({ data, canReverse, onReverse }: PaymentHistoryProps) {
  const overdue = overdueLabel(data.overdueDays);

  return (
    <section aria-label='Historial de pagos'>
      <header>
        <p>{paidThroughLabel(data.paidThroughAt)}</p>
        {overdue !== null ? <p role='status'>{overdue}</p> : null}
      </header>

      {data.payments.length === 0 ? null : (
        <table>
          <thead>
            <tr>
              <th scope='col'>Monto</th>
              <th scope='col'>Método</th>
              <th scope='col'>Período</th>
              <th scope='col'>Comprobante</th>
              <th scope='col'>Estado</th>
              <th scope='col'>
                <span className='sr-only'>Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.payments.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                canReverse={canReverse}
                onReverse={onReverse}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PaymentRow({
  payment,
  canReverse,
  onReverse
}: {
  payment: Payment;
  canReverse: boolean;
  onReverse: (payment: Payment) => void;
}) {
  const isReversalRow = payment.reversalOfPaymentId !== null;
  // Only an original, not-yet-reversed payment can be reversed. Offering it on
  // a reversal row would suggest reversals nest, which the API refuses.
  const offersReversal = canReverse && !payment.isReversed && !isReversalRow;

  return (
    <tr>
      <td>
        <span style={payment.isReversed ? { textDecoration: 'line-through' } : undefined}>
          {formatAmount(payment.amountMinorUnits, payment.currency)}
        </span>
      </td>
      <td>{METHOD_LABELS[payment.method] ?? payment.method}</td>
      <td>
        {formatPeriod(payment.periodStart)} — {formatPeriod(payment.periodEnd)}
      </td>
      <td>{payment.receiptReference ?? '—'}</td>
      <td>
        {payment.isReversed ? <span>Anulado</span> : null}
        {isReversalRow ? (
          <span>Anulación: {payment.reversalReason ?? 'sin motivo registrado'}</span>
        ) : null}
        {!payment.isReversed && !isReversalRow ? <span>Registrado</span> : null}
      </td>
      <td>
        {offersReversal ? (
          <button type='button' onClick={() => onReverse(payment)}>
            Anular
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function formatPeriod(date: string): string {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}
