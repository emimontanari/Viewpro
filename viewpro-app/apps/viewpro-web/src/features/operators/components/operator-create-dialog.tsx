'use client';

// Modal dialog to create a new operator (Design Decision 5: OWNER-provided
// temp password, min 12 chars, no forced rotation). Mirrors TenantPlanDialog's
// controlled-modal/form pattern. `inlineError` is set by the container on a
// 409 DUPLICATE_EMAIL response — every other mutation error surfaces as a
// toast (mirrors the tenants container's reportMutationError split).
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
import type { CreateOperatorPayload, OperatorRole } from '@/features/operators/api/types';

type Props = {
  open: boolean;
  isSaving: boolean;
  inlineError: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateOperatorPayload) => void;
};

const DEFAULT_ROLE: OperatorRole = 'ANALYST';
const ROLE_OPTIONS: { value: OperatorRole; label: string }[] = [
  { value: 'OWNER', label: 'Dueño' },
  { value: 'OPERATIONS', label: 'Operaciones' },
  { value: 'ANALYST', label: 'Analista' }
];

export function OperatorCreateDialog({ open, isSaving, inlineError, onClose, onSubmit }: Props) {
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OperatorRole>(DEFAULT_ROLE);
  const [tempPassword, setTempPassword] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setRole(DEFAULT_ROLE);
      setTempPassword('');
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        // Gate Escape/X-icon dismissal while the POST is in flight, same
        // pattern as TenantLimitsDialog/TenantPlanDialog.
        if (!nextOpen && !isSaving) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo operador</DialogTitle>
          <DialogDescription>
            Creá una cuenta de operador con un rol y una contraseña temporal.
          </DialogDescription>
        </DialogHeader>
        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ email, role, tempPassword });
          }}
        >
          <div className='space-y-2'>
            <Label htmlFor='operator-email'>Email</Label>
            <Input
              id='operator-email'
              type='email'
              required
              disabled={isSaving}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {inlineError ? <p className='text-destructive text-sm'>{inlineError}</p> : null}
          </div>
          <div className='space-y-2'>
            <Label htmlFor='operator-role'>Rol</Label>
            <select
              id='operator-role'
              aria-label='Rol'
              className='border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm'
              disabled={isSaving}
              value={role}
              onChange={(event) => setRole(event.target.value as OperatorRole)}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='operator-temp-password'>Contraseña temporal</Label>
            <Input
              id='operator-temp-password'
              type='password'
              required
              minLength={12}
              autoComplete='new-password'
              disabled={isSaving}
              value={tempPassword}
              onChange={(event) => setTempPassword(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type='button' variant='outline' disabled={isSaving} onClick={onClose}>
              Cancelar
            </Button>
            <Button type='submit' disabled={isSaving}>
              {isSaving ? 'Creando…' : 'Crear operador'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
