'use client';

// Container (D12): owns the list query, status/limits mutations, and dialog
// state. Presentational children (TenantsTable/TenantsPager/TenantsEmptyState/
// TenantLimitsDialog/TenantStatusConfirmDialog) are props-in/callbacks-out.
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { StepUpDialog } from '@/features/auth/components/step-up-dialog';
import { useStepUpGate } from '@/features/auth/hooks/use-step-up-gate';
import { tenantsKeys, tenantsListOptions } from '@/features/tenants/api/queries';
import { updateTenantLimits, updateTenantStatus } from '@/features/tenants/api/service';
import type { TenantLimits, TenantListItem, TenantStatusAction } from '@/features/tenants/api/types';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { TenantLimitsDialog } from './tenant-limits-dialog';
import { TenantStatusConfirmDialog } from './tenant-status-confirm-dialog';
import { TenantsEmptyState } from './tenants-empty-state';
import { TenantsPager } from './tenants-pager';
import { TenantsTable, type TenantAction } from './tenants-table';

const LIMIT = 50;
const NOT_FOUND_MESSAGE = 'La inmobiliaria no existe o fue eliminada.';
const TERMINAL_STATUS_MESSAGE = 'La inmobiliaria ya está dada de baja y no puede cambiar de estado.';

function TenantsLoadingSkeleton() {
  return (
    <div data-testid='tenants-loading-skeleton' className='flex flex-col gap-3'>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-12 w-full rounded-xl' />
      ))}
    </div>
  );
}

// D15: normalizes a mutation error into a toast message — 404 gets a specific
// "no existe" copy, every other status falls back to getApiErrorMessage.
function reportMutationError(error: unknown) {
  if (isApiError(error) && error.status === 404) {
    toast.error(NOT_FOUND_MESSAGE);
    return;
  }

  toast.error(getApiErrorMessage(error));
}

export function TenantsManagementPage() {
  const [offset, setOffset] = React.useState(0);
  const [pendingStatusAction, setPendingStatusAction] = React.useState<{
    tenant: TenantListItem;
    targetStatus: TenantStatusAction;
  } | null>(null);
  const [limitsTenant, setLimitsTenant] = React.useState<TenantListItem | null>(null);

  const queryClient = useQueryClient();
  const stepUpGate = useStepUpGate();

  const { data, isLoading, isError, error } = useQuery({
    ...tenantsListOptions(offset, LIMIT),
    retry: false
  });

  // D9: never patch optimistically — invalidate + let the active query refetch.
  const invalidateList = React.useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: tenantsKeys.all });
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: (input: { tenantId: string; status: TenantStatusAction }) =>
      updateTenantStatus(input.tenantId, { status: input.status }),
    onSuccess: async (result) => {
      if (result.unchanged) {
        toast.info('La inmobiliaria ya tenía ese estado.');
      } else {
        toast.success('Estado de la inmobiliaria actualizado.');
      }

      setPendingStatusAction(null);
      await invalidateList();
    },
    // D15: close the confirm dialog on failure too (mirrors onSuccess), and map a
    // 400 terminality reject to a Spanish message instead of leaking the raw
    // English backend copy — same style as the 404 mapping in reportMutationError.
    // D13: a 403 STEP_UP_REQUIRED is checked FIRST — the confirm dialog stays
    // open (no setPendingStatusAction(null), no toast) while the StepUpDialog
    // prompts for the password; on success the retry closure re-runs this
    // same mutation with the same variables.
    onError: (error, variables) => {
      if (stepUpGate.handleStepUpError(error, () => statusMutation.mutate(variables))) {
        return;
      }

      setPendingStatusAction(null);

      if (isApiError(error) && error.status === 400) {
        toast.error(TERMINAL_STATUS_MESSAGE);
        return;
      }

      reportMutationError(error);
    }
  });

  const limitsMutation = useMutation({
    mutationFn: (input: { tenantId: string; limits: TenantLimits }) =>
      updateTenantLimits(input.tenantId, input.limits),
    onSuccess: async (result) => {
      if (result.unchanged) {
        toast.info('La inmobiliaria ya tenía esos límites.');
      } else {
        toast.success('Límites de la inmobiliaria actualizados.');
      }

      setLimitsTenant(null);
      await invalidateList();
    },
    // D13: same step-up-first gate as statusMutation — reuses the shared
    // useStepUpGate instance, so both destructive surfaces prompt through the
    // same modal.
    onError: (error, variables) => {
      if (stepUpGate.handleStepUpError(error, () => limitsMutation.mutate(variables))) {
        return;
      }

      reportMutationError(error);
    }
  });

  const isMutating = statusMutation.isPending || limitsMutation.isPending;

  const handlePrev = React.useCallback(() => {
    setOffset((current) => Math.max(0, current - LIMIT));
  }, []);

  const handleNext = React.useCallback(() => {
    setOffset((current) => (data && current + LIMIT < data.total ? current + LIMIT : current));
  }, [data]);

  // D8/D6/D7: ACTIVATE/reactivate (toggle → ACTIVE) PATCHes directly; SUSPEND
  // (toggle → SUSPENDED) and CANCEL (destructive) are both gated behind the
  // same AlertDialog confirm — only the copy variant differs.
  const handleStatusAction = React.useCallback(
    (item: TenantListItem, action: TenantAction) => {
      if (action.kind === 'toggle' && action.targetStatus === 'ACTIVE') {
        statusMutation.mutate({ tenantId: item.id, status: action.targetStatus });
        return;
      }

      setPendingStatusAction({ tenant: item, targetStatus: action.targetStatus });
    },
    [statusMutation]
  );

  const handleConfirmStatusAction = React.useCallback(() => {
    if (!pendingStatusAction) {
      return;
    }

    statusMutation.mutate({
      tenantId: pendingStatusAction.tenant.id,
      status: pendingStatusAction.targetStatus
    });
  }, [pendingStatusAction, statusMutation]);

  const handleSaveLimits = React.useCallback(
    (limits: TenantLimits) => {
      if (!limitsTenant) {
        return;
      }

      limitsMutation.mutate({ tenantId: limitsTenant.id, limits });
    },
    [limitsTenant, limitsMutation]
  );

  if (isLoading) {
    return <TenantsLoadingSkeleton />;
  }

  if (isError) {
    return (
      <div
        data-testid='tenants-error'
        className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
      >
        <p className='text-destructive font-semibold'>No se pudieron cargar las inmobiliarias</p>
        <p className='text-muted-foreground mt-1 text-sm'>{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  if (data.total === 0) {
    return <TenantsEmptyState />;
  }

  return (
    <div className='flex flex-col gap-4'>
      <TenantsTable
        items={data.items}
        isMutating={isMutating}
        onEditLimits={setLimitsTenant}
        onStatusAction={handleStatusAction}
      />
      <TenantsPager
        offset={offset}
        limit={LIMIT}
        total={data.total}
        disabled={isMutating}
        onPrev={handlePrev}
        onNext={handleNext}
      />
      <TenantStatusConfirmDialog
        tenant={pendingStatusAction?.tenant ?? null}
        isPending={statusMutation.isPending}
        variant={pendingStatusAction?.targetStatus === 'CANCELLED' ? 'cancel' : 'suspend'}
        onCancel={() => setPendingStatusAction(null)}
        onConfirm={handleConfirmStatusAction}
      />
      <TenantLimitsDialog
        tenant={limitsTenant}
        isSaving={limitsMutation.isPending}
        onClose={() => setLimitsTenant(null)}
        onSave={handleSaveLimits}
      />
      <StepUpDialog {...stepUpGate.dialogProps} />
    </div>
  );
}
