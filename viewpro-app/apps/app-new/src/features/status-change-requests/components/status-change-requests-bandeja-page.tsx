'use client';

import { approvalErrorMessage } from '../approval-error-message';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useApproveStatusChangeRequest,
  usePendingStatusChangeRequests,
  useRejectStatusChangeRequest
} from '../api/queries';
import { StatusChangeRequestsBandeja } from './status-change-requests-bandeja';

export function StatusChangeRequestsBandejaPage() {
  const { data: requests = [], isLoading } = usePendingStatusChangeRequests({ take: 200 });
  const approveMutation = useApproveStatusChangeRequest();
  const rejectMutation = useRejectStatusChangeRequest();

  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    requestId: string;
    engagementId: string;
  }>({ open: false, requestId: '', engagementId: '' });
  const [resolutionComment, setResolutionComment] = useState('');

  async function handleApprove(requestId: string, engagementId: string) {
    try {
      const result = await approveMutation.mutateAsync({ requestId, engagementId });
      toast.success(`Aprobada · estado actualizado a ${result.targetStatus}`);
    } catch (error) {
      toast.error(approvalErrorMessage(error));
    }
  }

  function openRejectDialog(requestId: string, engagementId: string) {
    setRejectDialog({ open: true, requestId, engagementId });
    setResolutionComment('');
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolutionComment.trim()) return;

    try {
      await rejectMutation.mutateAsync({
        requestId: rejectDialog.requestId,
        engagementId: rejectDialog.engagementId,
        payload: { resolutionComment: resolutionComment.trim() }
      });
      toast.success('Solicitud rechazada');
      setRejectDialog({ open: false, requestId: '', engagementId: '' });
      setResolutionComment('');
    } catch {
      toast.error('No se pudo rechazar la solicitud.');
    }
  }

  return (
    <>
      <div aria-live='polite' className='sr-only' id='bandeja-status-announcer' />

      <StatusChangeRequestsBandeja
        requests={requests}
        isLoading={isLoading}
        onApprove={handleApprove}
        onReject={openRejectDialog}
      />

      {/* Reject with comment dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialog({ open: false, requestId: '', engagementId: '' });
            setResolutionComment('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar solicitud</DialogTitle>
            <DialogDescription>
              Indicá el motivo del rechazo. El vendedor recibirá esta información.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectSubmit} className='flex flex-col gap-4'>
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='resolution-comment'>Motivo del rechazo</Label>
              <Textarea
                id='resolution-comment'
                value={resolutionComment}
                onChange={(e) => setResolutionComment(e.target.value)}
                placeholder='Ej: Documentación incompleta...'
                maxLength={1000}
                rows={4}
                required
                aria-required='true'
              />
            </div>
            {rejectMutation.isError && (
              <p className='text-sm text-destructive'>No se pudo rechazar la solicitud.</p>
            )}
            <div className='flex justify-end gap-2'>
              <Button
                type='button'
                variant='outline'
                onClick={() =>
                  setRejectDialog({ open: false, requestId: '', engagementId: '' })
                }
              >
                Cancelar
              </Button>
              <Button
                type='submit'
                variant='destructive'
                disabled={!resolutionComment.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
