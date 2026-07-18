'use client';

// AlertDialog confirm shown ONLY for the SUSPEND transition (mirrors
// TenantStatusConfirmDialog's suspend variant). REACTIVATE PATCHes directly
// from the container without this dialog — an operator has only ACTIVE/
// SUSPENDED, so there is a single confirm case (no CANCEL-style third state).
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { OperatorListItem } from '@/features/operators/api/types';

type Props = {
  operator: OperatorListItem | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function OperatorStatusConfirmDialog({ operator, isPending, onCancel, onConfirm }: Props) {
  return (
    <AlertDialog
      open={Boolean(operator)}
      onOpenChange={(open) => {
        // Gate Escape dismissal while the PATCH is in flight so the pending
        // label cannot be hidden mid-mutation (mirrors TenantStatusConfirmDialog).
        if (!open && !isPending) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Suspender operador</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción bloquea el acceso de {operator?.email ?? 'este operador'} a la consola hasta
            que lo reactives.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/*
            No explicit onClick here: AlertDialogCancel is a self-closing
            Radix Close, which already fires onOpenChange(false) — the shared
            gate above calls onCancel() from there. A duplicate onClick
            handler would double-invoke onCancel on every click.
          */}
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          {/*
            A plain Button here (not AlertDialogAction) intentionally — same
            reasoning as TenantStatusConfirmDialog: AlertDialogAction
            self-closes on click, which would hide the pending state before
            the mutation settles (relevant for a step-up-gated 403 retry).
          */}
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Suspendiendo…' : 'Suspender'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
