'use client';

import { useState, type FormEvent } from 'react';

type Props = {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
};

export function PropertyProposalReviewRejectDialog({ pending, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState('');
  const normalizedReason = reason.trim();
  const valid = normalizedReason.length >= 1 && normalizedReason.length <= 1000;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending && valid) onSubmit(normalizedReason);
  }

  return (
    <section role='dialog' aria-modal='true' aria-labelledby='proposal-rejection-title'>
      <h3 id='proposal-rejection-title'>Rechazar propuesta</h3>
      <form onSubmit={submit}>
        <label htmlFor='proposal-rejection-reason'>Motivo del rechazo</label>
        <textarea
            id='proposal-rejection-reason'
            aria-label='Motivo del rechazo'
            autoFocus
            maxLength={1000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
          />
        <p>Ingresá un motivo de 1 a 1000 caracteres.</p>
        <button type='button' onClick={onCancel} disabled={pending}>Cancelar</button>
        <button type='submit' disabled={pending || !valid}>Confirmar rechazo</button>
      </form>
    </section>
  );
}
