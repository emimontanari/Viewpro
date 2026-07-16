'use client';

// Container (mirrors TenantsManagementPage): owns the list query, the
// create/role/status mutations, and dialog state. Presentational children
// (OperatorsTable/OperatorCreateDialog/OperatorRoleDialog/
// OperatorStatusConfirmDialog/OperatorsEmptyState) are props-in/callbacks-out.
import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StepUpDialog } from '@/features/auth/components/step-up-dialog';
import { useStepUpGate } from '@/features/auth/hooks/use-step-up-gate';
import { operatorsKeys, operatorsListOptions } from '@/features/operators/api/queries';
import { createOperator, updateOperatorRole, updateOperatorStatus } from '@/features/operators/api/service';
import type {
  CreateOperatorPayload,
  OperatorListItem,
  OperatorRole,
  OperatorStatus
} from '@/features/operators/api/types';
import { getApiErrorMessage, isApiError } from '@/lib/api-client';
import { OperatorCreateDialog } from './operator-create-dialog';
import { OperatorRoleDialog } from './operator-role-dialog';
import { OperatorStatusConfirmDialog } from './operator-status-confirm-dialog';
import { OperatorsEmptyState } from './operators-empty-state';
import { getOperatorStatusAction, OperatorsTable, type OperatorStatusAction } from './operators-table';

const DUPLICATE_EMAIL_MESSAGE = 'Ese email ya está registrado.';

function OperatorsLoadingSkeleton() {
  return (
    <div data-testid='operators-loading-skeleton' className='flex flex-col gap-3'>
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className='h-12 w-full rounded-xl' />
      ))}
    </div>
  );
}

export function OperatorsManagementPage() {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [createInlineError, setCreateInlineError] = React.useState<string | null>(null);
  const [roleOperator, setRoleOperator] = React.useState<OperatorListItem | null>(null);
  const [pendingStatusOperator, setPendingStatusOperator] = React.useState<OperatorListItem | null>(null);

  const queryClient = useQueryClient();
  const stepUpGate = useStepUpGate();

  const { data, isLoading, isError, error } = useQuery({
    ...operatorsListOptions(),
    retry: false
  });

  // Never patch optimistically — invalidate + let the active query refetch
  // (mirrors TenantsManagementPage's D9).
  const invalidateList = React.useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: operatorsKeys.all });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateOperatorPayload) => createOperator(payload),
    onSuccess: async () => {
      toast.success('Operador creado.');
      setIsCreateOpen(false);
      setCreateInlineError(null);
      await invalidateList();
    },
    onError: (mutationError, variables) => {
      if (stepUpGate.handleStepUpError(mutationError, () => createMutation.mutate(variables))) {
        return;
      }

      // 409 DUPLICATE_EMAIL stays inline in the still-open dialog — every
      // other error surfaces as a toast (mirrors the tenants container's
      // 404/generic split, reportMutationError).
      if (isApiError(mutationError) && mutationError.status === 409) {
        setCreateInlineError(DUPLICATE_EMAIL_MESSAGE);
        return;
      }

      toast.error(getApiErrorMessage(mutationError));
    }
  });

  const roleMutation = useMutation({
    mutationFn: (input: { operatorId: string; role: OperatorRole }) =>
      updateOperatorRole(input.operatorId, { role: input.role }),
    onSuccess: async () => {
      toast.success('Rol del operador actualizado.');
      setRoleOperator(null);
      await invalidateList();
    },
    onError: (mutationError, variables) => {
      if (stepUpGate.handleStepUpError(mutationError, () => roleMutation.mutate(variables))) {
        return;
      }

      // 422 self-demote / last-owner guardrail — surfaced verbatim (English
      // backend copy, per the operator-console's error-mapping convention
      // for guardrail violations; unlike tenants' 400 terminality mapping,
      // no Spanish remap exists for these operator-only codes yet).
      toast.error(getApiErrorMessage(mutationError));
    }
  });

  const statusMutation = useMutation({
    mutationFn: (input: { operatorId: string; status: OperatorStatus }) =>
      updateOperatorStatus(input.operatorId, { status: input.status }),
    onSuccess: async () => {
      toast.success('Estado del operador actualizado.');
      setPendingStatusOperator(null);
      await invalidateList();
    },
    // Step-up-gated failure keeps the confirm dialog open/pending (D13-style,
    // mirrors TenantsManagementPage's statusMutation.onError); any other
    // failure closes the dialog too, same as onSuccess, and surfaces a toast.
    onError: (mutationError, variables) => {
      if (stepUpGate.handleStepUpError(mutationError, () => statusMutation.mutate(variables))) {
        return;
      }

      setPendingStatusOperator(null);
      toast.error(getApiErrorMessage(mutationError));
    }
  });

  const isMutating = createMutation.isPending || roleMutation.isPending || statusMutation.isPending;

  const handleStatusAction = React.useCallback(
    (item: OperatorListItem, action: OperatorStatusAction) => {
      if (action.targetStatus === 'ACTIVE') {
        statusMutation.mutate({ operatorId: item.id, status: 'ACTIVE' });
        return;
      }

      setPendingStatusOperator(item);
    },
    [statusMutation]
  );

  const handleConfirmStatusAction = React.useCallback(() => {
    if (!pendingStatusOperator) {
      return;
    }

    const action = getOperatorStatusAction(pendingStatusOperator);
    statusMutation.mutate({ operatorId: pendingStatusOperator.id, status: action.targetStatus });
  }, [pendingStatusOperator, statusMutation]);

  const handleCreateSubmit = React.useCallback(
    (payload: CreateOperatorPayload) => {
      setCreateInlineError(null);
      createMutation.mutate(payload);
    },
    [createMutation]
  );

  const handleRoleSubmit = React.useCallback(
    (role: OperatorRole) => {
      if (!roleOperator) {
        return;
      }

      roleMutation.mutate({ operatorId: roleOperator.id, role });
    },
    [roleOperator, roleMutation]
  );

  if (isLoading) {
    return <OperatorsLoadingSkeleton />;
  }

  if (isError) {
    return (
      <div
        data-testid='operators-error'
        className='border-destructive/30 bg-destructive/5 rounded-xl border p-6'
      >
        <p className='text-destructive font-semibold'>No se pudieron cargar los operadores</p>
        <p className='text-muted-foreground mt-1 text-sm'>{getApiErrorMessage(error)}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex justify-end'>
        <Button type='button' onClick={() => setIsCreateOpen(true)}>
          Nuevo operador
        </Button>
      </div>
      {data.length === 0 ? (
        <OperatorsEmptyState />
      ) : (
        <OperatorsTable
          items={data}
          isMutating={isMutating}
          onChangeRole={setRoleOperator}
          onStatusAction={handleStatusAction}
        />
      )}
      <OperatorCreateDialog
        open={isCreateOpen}
        isSaving={createMutation.isPending}
        inlineError={createInlineError}
        onClose={() => {
          setIsCreateOpen(false);
          setCreateInlineError(null);
        }}
        onSubmit={handleCreateSubmit}
      />
      <OperatorRoleDialog
        operator={roleOperator}
        isSaving={roleMutation.isPending}
        onClose={() => setRoleOperator(null)}
        onSubmit={handleRoleSubmit}
      />
      <OperatorStatusConfirmDialog
        operator={pendingStatusOperator}
        isPending={statusMutation.isPending}
        onCancel={() => setPendingStatusOperator(null)}
        onConfirm={handleConfirmStatusAction}
      />
      <StepUpDialog {...stepUpGate.dialogProps} />
    </div>
  );
}
