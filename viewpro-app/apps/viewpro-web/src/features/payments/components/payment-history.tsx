'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
    <section aria-label='Historial de pagos' className='space-y-3'>
      <header className='flex flex-wrap items-center gap-2'>
        <p className='text-muted-foreground text-sm'>{paidThroughLabel(data.paidThroughAt)}</p>
        {overdue !== null ? (
          <Badge role='status' variant='destructive' className='rounded-full'>
            {overdue}
          </Badge>
        ) : null}
      </header>

      {data.payments.length === 0 ? null : (
        // The ledger can outgrow the dialog on both axes; scrolling the table
        // keeps the dialog from stretching the viewport.
        <div className='max-h-80 overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>
                  <span className='sr-only'>Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  canReverse={canReverse}
                  onReverse={onReverse}
                />
              ))}
            </TableBody>
          </Table>
        </div>
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
    <TableRow>
      <TableCell className='font-medium tabular-nums'>
        <span className={payment.isReversed ? 'line-through' : undefined}>
          {formatAmount(payment.amountMinorUnits, payment.currency)}
        </span>
      </TableCell>
      <TableCell>{METHOD_LABELS[payment.method] ?? payment.method}</TableCell>
      <TableCell className='whitespace-nowrap'>
        {formatPeriod(payment.periodStart)} — {formatPeriod(payment.periodEnd)}
      </TableCell>
      <TableCell className='text-muted-foreground'>{payment.receiptReference ?? '—'}</TableCell>
      <TableCell>
        {payment.isReversed ? (
          <Badge variant='destructive' className='rounded-full'>
            Anulado
          </Badge>
        ) : null}
        {isReversalRow ? (
          <span className='text-muted-foreground text-xs'>
            Anulación: {payment.reversalReason ?? 'sin motivo registrado'}
          </span>
        ) : null}
        {!payment.isReversed && !isReversalRow ? (
          <Badge variant='outline' className='rounded-full'>
            Registrado
          </Badge>
        ) : null}
      </TableCell>
      <TableCell className='text-right'>
        {offersReversal ? (
          <Button type='button' variant='outline' size='sm' onClick={() => onReverse(payment)}>
            Anular
          </Button>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

function formatPeriod(date: string): string {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}
