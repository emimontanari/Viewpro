'use client';

// D11: shared password re-entry modal, instantiated once (by TenantsManagementPage
// today) via useStepUpGate(). Controlled entirely by the hook's dialogProps — no
// local open/close affordance is exposed while isVerifying is true, mirroring the
// pending-progress Escape-gating already used by tenant-limits-dialog.tsx /
// tenant-status-confirm-dialog.tsx.
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

type Props = {
  open: boolean;
  isVerifying: boolean;
  error?: string;
  onSubmit: (password: string) => void;
  onOpenChange?: (open: boolean) => void;
};

export function StepUpDialog({ open, isVerifying, error, onSubmit, onOpenChange }: Props) {
  const [password, setPassword] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setPassword('');
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Gate Escape/X-icon dismissal while the step-up request is in
        // flight, same pattern as TenantLimitsDialog/TenantStatusConfirmDialog.
        if (!nextOpen && isVerifying) {
          return;
        }

        onOpenChange?.(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmá tu contraseña</DialogTitle>
          <DialogDescription>
            Por seguridad, volvé a ingresar tu contraseña para continuar con esta acción.
          </DialogDescription>
        </DialogHeader>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(password);
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='step-up-password'>Contraseña</Label>
            <Input
              id='step-up-password'
              type='password'
              autoComplete='current-password'
              disabled={isVerifying}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <p className='text-destructive text-sm'>{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={isVerifying}
              onClick={() => onOpenChange?.(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={isVerifying}>
              {isVerifying ? 'Verificando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
