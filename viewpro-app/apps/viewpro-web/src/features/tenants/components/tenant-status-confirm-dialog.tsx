'use client';

// AlertDialog confirm shown for the SUSPEND transition (D8) and the
// destructive CANCEL transition (D7, D6) — ACTIVATE/reactivate PATCHes
// directly from the container without this dialog. One dialog, two copy
// variants — the pending/Escape gating below is shared, not duplicated.
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
import type { TenantListItem } from '@/features/tenants/api/types';

type Variant = 'suspend' | 'cancel';

type Props = {
  tenant: TenantListItem | null;
  isPending: boolean;
  variant?: Variant;
  onCancel: () => void;
  onConfirm: () => void;
};

const COPY: Record<
  Variant,
  { title: string; description: (name: string) => string; confirmLabel: string; pendingLabel: string }
> = {
  suspend: {
    title: 'Suspender inquilino',
    description: (name) =>
      `Esta acción bloquea el acceso operativo de ${name} hasta que lo reactives.`,
    confirmLabel: 'Suspender',
    pendingLabel: 'Suspendiendo…'
  },
  cancel: {
    title: 'Cancelar inquilino definitivamente',
    description: (name) =>
      `Esta acción da de baja a ${name} de forma permanente y no se puede deshacer. El inquilino perderá el acceso operativo.`,
    confirmLabel: 'Cancelar definitivamente',
    pendingLabel: 'Cancelando…'
  }
};

export function TenantStatusConfirmDialog({
  tenant,
  isPending,
  variant = 'suspend',
  onCancel,
  onConfirm
}: Props) {
  const copy = COPY[variant];

  return (
    <AlertDialog
      open={Boolean(tenant)}
      onOpenChange={(open) => {
        // Gate Escape dismissal while the PATCH is in flight so the
        // pending-progress label cannot be hidden mid-mutation (shared
        // across both variants).
        if (!open && !isPending) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.description(tenant?.name ?? 'este inquilino')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          {/*
            A plain Button here (not AlertDialogAction) intentionally: Radix's
            AlertDialogAction is a self-closing DialogPrimitive.Close, so it
            would fire onOpenChange(false) synchronously on click — before the
            mutation's `isPending` state has re-rendered — and unconditionally
            close this dialog regardless of outcome. A step-up-gated failure
            (D13) needs this dialog to stay open/pending until the mutation
            actually settles, so closing is driven entirely by
            pendingStatusAction (onSuccess / non-step-up onError).
          */}
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? copy.pendingLabel : copy.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
