'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import type { TenantListItem } from '@/features/tenants/api/types';
import { TenantPaymentsPanel } from './tenant-payments-panel';

type Props = {
  tenant: TenantListItem | null;
  onClose: () => void;
};

/**
 * TenantPaymentsDialog — the money ledger for one tenant, opened from its row.
 *
 * It lives on the LIST rather than the detail page for a concrete reason: the
 * tenant detail response carries no human-readable name (its header renders a
 * short code), and the record dialog names the agency being charged as its
 * guard against booking a payment against the wrong one. The row is where that
 * name exists.
 */
export function TenantPaymentsDialog({ tenant, onClose }: Props) {
  return (
    <Dialog open={Boolean(tenant)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Pagos de {tenant?.name}</DialogTitle>
          <DialogDescription>
            Registro de pagos de la inmobiliaria. Los pagos no se editan ni se borran: se corrigen
            con una anulación que queda asentada.
          </DialogDescription>
        </DialogHeader>

        {tenant ? (
          <TenantPaymentsPanel
            tenantId={tenant.id}
            tenantName={tenant.name}
            tenantPlan={tenant.plan}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
