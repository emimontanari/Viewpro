'use client';

import { creationErrorMessage } from '../approval-error-message';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateStatusChangeRequest } from '../api/queries';
import type { PropertyEngagementStatus } from '../api/types';
import { PROPERTY_ENGAGEMENT_STATUSES } from '../api/types';

const STATUS_LABELS: Record<PropertyEngagementStatus, string> = {
  CAPTURE: 'CAPTURE',
  DOCUMENTATION_PENDING: 'DOCUMENTATION_PENDING',
  PUBLICATION_PREPARATION: 'PUBLICATION_PREPARATION',
  ACTIVE_PUBLICATION: 'ACTIVE_PUBLICATION',
  INQUIRIES_AND_VISITS: 'INQUIRIES_AND_VISITS',
  OFFER_NEGOTIATION: 'OFFER_NEGOTIATION',
  RESERVATION_STARTED: 'RESERVATION_STARTED',
  FINAL_DOCUMENTATION: 'FINAL_DOCUMENTATION',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED'
};

type RequestStatusChangeDialogProps = {
  engagementId: string;
  currentStatus: PropertyEngagementStatus;
  onSuccess?: () => void;
};

export function RequestStatusChangeDialog({
  engagementId,
  currentStatus,
  onSuccess
}: RequestStatusChangeDialogProps) {
  const [open, setOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<PropertyEngagementStatus | ''>('');
  const [requestNote, setRequestNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const createMutation = useCreateStatusChangeRequest(engagementId);

  const availableStatuses = PROPERTY_ENGAGEMENT_STATUSES.filter((s) => s !== currentStatus);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetStatus) return;

    try {
      await createMutation.mutateAsync({
        targetStatus,
        currentStatusSnapshot: currentStatus,
        requestNote: requestNote.trim() || undefined
      });
      setSubmitted(true);
      setOpen(false);
      onSuccess?.();
    } catch {
      // Error handled by mutation
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      // Reset form state on close
      setTargetStatus('');
      setRequestNote('');
      setSubmitted(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm'>
          Solicitar cambio de estado
        </Button>
      </DialogTrigger>

      <DialogContent aria-describedby='status-change-dialog-description'>
        <DialogHeader>
          <DialogTitle>Solicitar cambio de estado</DialogTitle>
          <DialogDescription id='status-change-dialog-description'>
            Enviá una solicitud al gerente para cambiar el estado de esta propiedad.
          </DialogDescription>
        </DialogHeader>

        {/* Pending notice — appears after successful submission */}
        <div role='status' aria-live='polite'>
          {submitted && (
            <p className='text-sm text-amber-600 dark:text-amber-400'>
              Solicitud de cambio de estado enviada. Pendiente de aprobación.
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          {/* Target status */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='target-status'>Estado objetivo</Label>
            <Select
              value={targetStatus}
              onValueChange={(v) => setTargetStatus(v as PropertyEngagementStatus)}
            >
              <SelectTrigger id='target-status' aria-label='Estado objetivo'>
                <SelectValue placeholder='Seleccioná un estado' />
              </SelectTrigger>
              <SelectContent>
                {availableStatuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Request note */}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='request-note'>Nota (opcional)</Label>
            <Textarea
              id='request-note'
              value={requestNote}
              onChange={(e) => setRequestNote(e.target.value)}
              maxLength={1000}
              placeholder='Comentario sobre el cambio solicitado...'
              rows={3}
              aria-label='Nota'
            />
          </div>

          {/* Error */}
          {createMutation.isError && (
            <p className='text-sm text-destructive'>
              {creationErrorMessage(createMutation.error)}
            </p>
          )}

          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type='submit'
              disabled={!targetStatus || createMutation.isPending}
              aria-label='Solicitar cambio de estado'
            >
              {createMutation.isPending ? 'Enviando...' : 'Solicitar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
