'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PaymentMethod, PlanCode, RecordPaymentInput } from '@/features/payments/api/types';
import { toMinorUnits } from './money-format';

type TenantRef = { id: string; name: string; plan: string | null };

type Props = {
  tenant: TenantRef | null;
  isSaving: boolean;
  onClose: () => void;
  onRecord: (input: RecordPaymentInput) => void;
};

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Transferencia' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'MERCADOPAGO_LINK', label: 'Mercado Pago' },
  { value: 'OTHER', label: 'Otro' }
];

const PLAN_OPTIONS: PlanCode[] = ['BASICO', 'PROFESIONAL', 'EMPRESA'];

/**
 * RecordPaymentDialog — registers a payment against one tenant.
 *
 * The tenant's NAME is shown in the dialog body, not just its row. Recording
 * against the wrong tenant is the mistake this form makes easiest and the
 * ledger makes hardest to undo: the correction is a reversal that both rows
 * keep forever. Naming the agency in front of the operator costs nothing and
 * prevents the one error with no clean fix.
 *
 * The amount is converted with `toMinorUnits`, which is string-based. It must
 * never be parsed with Number() anywhere in this flow.
 *
 * A STEP_UP_REQUIRED failure is not handled here — the calling page routes it
 * through useStepUpGate and retries `onRecord`, so a lapsed sudo window
 * re-opens the password modal instead of surfacing as a generic error.
 */
export function RecordPaymentDialog({ tenant, isSaving, onClose, onRecord }: Props) {
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('BANK_TRANSFER');
  const [plan, setPlan] = React.useState<PlanCode>('PROFESIONAL');
  const [periodStart, setPeriodStart] = React.useState('');
  const [periodEnd, setPeriodEnd] = React.useState('');
  const [receiptReference, setReceiptReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!tenant) {
      return;
    }

    setAmount('');
    setMethod('BANK_TRANSFER');
    setPlan((tenant.plan as PlanCode | null) ?? 'PROFESIONAL');
    setPeriodStart('');
    setPeriodEnd('');
    setReceiptReference('');
    setNote('');
    setError(null);
  }, [tenant]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    let amountMinorUnits: string;

    try {
      amountMinorUnits = toMinorUnits(amount);
    } catch (conversionError) {
      setError(conversionError instanceof Error ? conversionError.message : 'Monto inválido');
      return;
    }

    if (periodEnd <= periodStart) {
      setError('El fin del período debe ser posterior al inicio');
      return;
    }

    onRecord({
      amountMinorUnits,
      method,
      plan,
      periodStart,
      periodEnd,
      receiptReference: receiptReference.trim() || undefined,
      note: note.trim() || undefined
    });
  }

  return (
    <Dialog
      open={Boolean(tenant)}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Vas a registrar un pago para <strong>{tenant?.name}</strong>. El registro no se puede
            editar ni borrar: si te equivocás, se corrige con una anulación que queda asentada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div>
            <Label htmlFor='payment-amount'>Monto</Label>
            <Input
              id='payment-amount'
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder='45000,00'
              inputMode='decimal'
              required
            />
          </div>

          <div>
            <Label htmlFor='payment-method'>Método</Label>
            <select
              id='payment-method'
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor='payment-plan'>Plan</Label>
            <select
              id='payment-plan'
              value={plan}
              onChange={(event) => setPlan(event.target.value as PlanCode)}
            >
              {PLAN_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor='payment-period-start'>Período desde</Label>
            <Input
              id='payment-period-start'
              type='date'
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor='payment-period-end'>Período hasta</Label>
            <Input
              id='payment-period-end'
              type='date'
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor='payment-receipt'>Comprobante</Label>
            <Input
              id='payment-receipt'
              value={receiptReference}
              onChange={(event) => setReceiptReference(event.target.value)}
              placeholder='Nº de transferencia'
            />
          </div>

          <div>
            <Label htmlFor='payment-note'>Nota</Label>
            <Input
              id='payment-note'
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error !== null ? <p role='alert'>{error}</p> : null}

          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
