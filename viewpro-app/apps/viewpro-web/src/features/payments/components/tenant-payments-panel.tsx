'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { StepUpDialog } from '@/features/auth/components/step-up-dialog';
import { useStepUpGate } from '@/features/auth/hooks/use-step-up-gate';
import { paymentKeys, tenantPaymentsOptions } from '@/features/payments/api/queries';
import { recordPayment, reversePayment } from '@/features/payments/api/service';
import type { Payment, RecordPaymentInput } from '@/features/payments/api/types';
import { tenantsKeys } from '@/features/tenants/api/queries';
import { useSession } from '@/lib/session-context';
import { getApiErrorMessage } from '@/lib/api-client';
import { PaymentHistory } from './payment-history';
import { RecordPaymentDialog } from './record-payment-dialog';
import { ReversePaymentDialog } from './reverse-payment-dialog';

type Props = {
  tenantId: string;
  tenantName: string;
  tenantPlan: string | null;
};

/**
 * TenantPaymentsPanel — container for the money ledger on a tenant's page.
 *
 * Owns the history query and both mutations. A STEP_UP_REQUIRED response is
 * routed through useStepUpGate and the original mutation retried after the
 * operator re-enters their password — never surfaced as a generic error and
 * never treated as a logout, which is what a lapsed sudo window would
 * otherwise look like to someone mid-form.
 *
 * `canReverse` comes from the session role. The server enforces OWNER-only
 * regardless; hiding the action keeps the UI from advertising a capability
 * the operator does not have.
 */
export function TenantPaymentsPanel({ tenantId, tenantName, tenantPlan }: Props) {
  const [isRecording, setIsRecording] = React.useState(false);
  const [reversing, setReversing] = React.useState<Payment | null>(null);

  const session = useSession();
  const queryClient = useQueryClient();
  const stepUpGate = useStepUpGate();

  const canReverse = session.session?.operator.role === 'OWNER';

  const { data, isLoading, isError, error } = useQuery({
    ...tenantPaymentsOptions(tenantId),
    retry: false
  });

  /**
   * Every view that derives money state has to be invalidated, not just the
   * history this dialog shows.
   *
   * JUDGMENT DAY FIX: only the per-tenant key was invalidated. The tenant list
   * behind this dialog renders the paid-through / overdue BillingCell from the
   * tenants query, and the dashboard renders revenue from a third key — with
   * the app's global staleTime of 60s, the overdue badge kept claiming a tenant
   * was late for up to a minute after the payment that cleared it. That badge
   * is the ONLY signal a tenant stopped paying, so it going stale defeats the
   * whole "warn, don't cut" design.
   */
  const invalidate = React.useCallback(() => {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: paymentKeys.byTenant(tenantId) }),
      queryClient.invalidateQueries({ queryKey: paymentKeys.revenue() }),
      queryClient.invalidateQueries({ queryKey: tenantsKeys.all })
    ]);
  }, [queryClient, tenantId]);

  const recordMutation = useMutation({
    mutationFn: (input: RecordPaymentInput) => recordPayment(tenantId, input),
    onSuccess: async () => {
      toast.success('Pago registrado.');
      setIsRecording(false);
      await invalidate();
    },
    onError: (mutationError, input) => {
      // Retry the exact same submission once the operator re-authenticates.
      if (stepUpGate.handleStepUpError(mutationError, () => recordMutation.mutate(input))) {
        return;
      }

      toast.error(getApiErrorMessage(mutationError));
    }
  });

  const reverseMutation = useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) =>
      reversePayment(input.paymentId, input.reason),
    onSuccess: async () => {
      toast.success('Pago anulado.');
      setReversing(null);
      await invalidate();
    },
    onError: (mutationError, input) => {
      if (stepUpGate.handleStepUpError(mutationError, () => reverseMutation.mutate(input))) {
        return;
      }

      toast.error(getApiErrorMessage(mutationError));
    }
  });

  return (
    <section className='space-y-4'>
      <header className='flex items-center justify-between gap-4'>
        <h2 className='text-base font-semibold'>Pagos</h2>
        <Button type='button' size='sm' onClick={() => setIsRecording(true)}>
          Registrar pago
        </Button>
      </header>

      {isLoading ? <p className='text-muted-foreground text-sm'>Cargando pagos…</p> : null}
      {isError ? (
        <p role='alert' className='text-destructive text-sm'>
          {getApiErrorMessage(error)}
        </p>
      ) : null}

      {data ? (
        <PaymentHistory data={data} canReverse={canReverse} onReverse={setReversing} />
      ) : null}

      <RecordPaymentDialog
        tenant={isRecording ? { id: tenantId, name: tenantName, plan: tenantPlan } : null}
        isSaving={recordMutation.isPending}
        onClose={() => setIsRecording(false)}
        onRecord={(input) => recordMutation.mutate(input)}
      />

      <ReversePaymentDialog
        payment={reversing}
        tenantName={tenantName}
        isSaving={reverseMutation.isPending}
        onClose={() => setReversing(null)}
        onReverse={(reason) => {
          if (reversing) {
            reverseMutation.mutate({ paymentId: reversing.id, reason });
          }
        }}
      />

      <StepUpDialog {...stepUpGate.dialogProps} />
    </section>
  );
}
