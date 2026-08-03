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
import type { Payment } from '@/features/payments/api/types';
import { formatAmount } from './money-format';

type Props = {
  payment: Payment | null;
  tenantName: string;
  isSaving: boolean;
  onClose: () => void;
  onReverse: (reason: string) => void;
};

const MIN_REASON_LENGTH = 3;

/**
 * ReversePaymentDialog — cancels a recorded payment.
 *
 * The reason is mandatory here as well as server-side, and the dialog states
 * plainly that both rows survive. An operator should understand before
 * confirming that this is not an undo: the original stays in the ledger and
 * the reversal is recorded next to it, with their name on it.
 */
export function ReversePaymentDialog({
  payment,
  tenantName,
  isSaving,
  onClose,
  onReverse
}: Props) {
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReason('');
    setError(null);
  }, [payment]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (reason.trim().length < MIN_REASON_LENGTH) {
      setError('Explicá por qué se anula este pago');
      return;
    }

    setError(null);
    onReverse(reason.trim());
  }

  return (
    <Dialog
      open={Boolean(payment)}
      onOpenChange={(open) => {
        if (!open && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anular pago</DialogTitle>
          <DialogDescription>
            Vas a anular un pago de{' '}
            <strong>
              {payment ? formatAmount(payment.amountMinorUnits, payment.currency) : ''}
            </strong>{' '}
            de <strong>{tenantName}</strong>. El pago original no se borra: queda asentado junto a
            la anulación, con tu usuario y el motivo.
          </DialogDescription>
        </DialogHeader>

        <form className='space-y-4' onSubmit={handleSubmit}>
          <div className='space-y-2'>
            <Label htmlFor='reversal-reason'>Motivo</Label>
            <Input
              id='reversal-reason'
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder='Transferencia no recibida'
              required
              disabled={isSaving}
            />
          </div>

          {error !== null ? (
            <p role='alert' className='text-destructive text-sm'>
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type='button' variant='outline' onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type='submit' variant='destructive' disabled={isSaving}>
              {isSaving ? 'Anulando…' : 'Anular pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
