'use client';

// AlertDialog confirm shown only for the SUSPEND transition (D8) — ACTIVATE/
// reactivate PATCHes directly from the container without this dialog.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import type { TenantListItem } from '@/features/tenants/api/types';

type Props = {
  tenant: TenantListItem | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TenantStatusConfirmDialog({ tenant, isPending, onCancel, onConfirm }: Props) {
  return (
    <AlertDialog
      open={Boolean(tenant)}
      onOpenChange={(open) => {
        // Gate Escape dismissal while the PATCH is in flight so the
        // "Suspendiendo…" progress cannot be hidden mid-mutation.
        if (!open && !isPending) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Suspender inquilino</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción bloquea el acceso operativo de {tenant?.name ?? 'este inquilino'} hasta
            que lo reactives.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Suspendiendo…' : 'Suspender'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
