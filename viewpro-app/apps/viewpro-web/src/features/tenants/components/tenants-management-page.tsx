'use client';

// Container (D12): owns the list query, status/limits mutations, and dialog
// state. Presentational children (TenantsTable/TenantsPager/TenantsEmptyState/
// TenantLimitsDialog/TenantStatusConfirmDialog) are props-in/callbacks-out.
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { tenantsKeys, tenantsListOptions } from '@/features/tenants/api/queries';
import { updateTenantLimits, updateTenantStatus } from '@/features/tenants/api/service';
import type { TenantLimits, TenantListItem, TenantStatusAction } from '@/features/tenants/api/types';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { TenantLimitsDialog } from './tenant-limits-dialog';
import { TenantStatusConfirmDialog } from './tenant-status-confirm-dialog';
import { TenantsEmptyState } from './tenants-empty-state';
import { TenantsPager } from './tenants-pager';
import { getTenantAction, TenantsTable } from './tenants-table';

const LIMIT = 50;
const NOT_FOUND_MESSAGE = 'El inquilino no existe o fue eliminado.';

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
  const [pendingStatusTenant, setPendingStatusTenant] = React.useState<TenantListItem | null>(
    null
  );
  const [limitsTenant, setLimitsTenant] = React.useState<TenantListItem | null>(null);

  const queryClient = useQueryClient();

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
        toast.info('El inquilino ya tenía ese estado.');
      } else {
        toast.success('Estado del inquilino actualizado.');
      }

      setPendingStatusTenant(null);
      await invalidateList();
    },
    onError: reportMutationError
  });

  const limitsMutation = useMutation({
    mutationFn: (input: { tenantId: string; limits: TenantLimits }) =>
      updateTenantLimits(input.tenantId, input.limits),
    onSuccess: async (result) => {
      if (result.unchanged) {
        toast.info('El inquilino ya tenía esos límites.');
      } else {
        toast.success('Límites del inquilino actualizados.');
      }

      setLimitsTenant(null);
      await invalidateList();
    },
    onError: reportMutationError
  });

  const isMutating = statusMutation.isPending || limitsMutation.isPending;

  const handlePrev = React.useCallback(() => {
    setOffset((current) => Math.max(0, current - LIMIT));
  }, []);

  const handleNext = React.useCallback(() => {
    setOffset((current) => (data && current + LIMIT < data.total ? current + LIMIT : current));
  }, [data]);

  // D8: SUSPEND is gated behind the AlertDialog confirm; ACTIVATE/reactivate
  // PATCHes directly.
  const handleToggleStatus = React.useCallback(
    (item: TenantListItem) => {
      const action = getTenantAction(item);

      if (!action) {
        return;
      }

      if (action.targetStatus === 'SUSPENDED') {
        setPendingStatusTenant(item);
        return;
      }

      statusMutation.mutate({ tenantId: item.id, status: action.targetStatus });
    },
    [statusMutation]
  );

  const handleConfirmSuspend = React.useCallback(() => {
    if (!pendingStatusTenant) {
      return;
    }

    statusMutation.mutate({ tenantId: pendingStatusTenant.id, status: 'SUSPENDED' });
  }, [pendingStatusTenant, statusMutation]);

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
        <p className='text-destructive font-semibold'>No se pudieron cargar los inquilinos</p>
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
        onToggleStatus={handleToggleStatus}
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
        tenant={pendingStatusTenant}
        isPending={statusMutation.isPending}
        onCancel={() => setPendingStatusTenant(null)}
        onConfirm={handleConfirmSuspend}
      />
      <TenantLimitsDialog
        tenant={limitsTenant}
        isSaving={limitsMutation.isPending}
        onClose={() => setLimitsTenant(null)}
        onSave={handleSaveLimits}
      />
    </div>
  );
}
