'use client';

import { hasErrorCode } from '@/lib/bff-client';
import { agentAssignmentErrorMessage, primaryAgentMutationErrorMessage } from '../error-messages';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { assignableProductAgentsOptions, productByIdOptions, productKeys } from '../api/queries';
import {
  assignProductAgent,
  clearPrimaryProductAgent,
  removeProductAgent,
  setPrimaryProductAgent
} from '../api/service';
import type { PropertyAssignedAgent } from '../api/types';
import { ManagePropertyAgentsDialog, PropertyAgentsPanel } from './manage-property-agents-dialog';

type PropertyAgentsSectionProps = {
  agents: PropertyAssignedAgent[];
  canManageAgents?: boolean;
  isArchived: boolean;
  productId: string;
  tenantId: string | null;
};

export function PropertyAgentsSection({
  agents,
  canManageAgents = true,
  isArchived,
  productId,
  tenantId
}: PropertyAgentsSectionProps) {
  const queryClient = useQueryClient();
  const [agentsDialogOpen, setAgentsDialogOpen] = useState(false);
  const [assigningAgentUserId, setAssigningAgentUserId] = useState<string | null>(null);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const assignableAgentsQuery = useQuery({
    ...assignableProductAgentsOptions(tenantId),
    enabled: agentsDialogOpen && canManageAgents && !isArchived
  });
  const primaryAgentId = agents.find((agent) => agent.isPrimary)?.id ?? null;
  const assignAgentMutation = useMutation({
    mutationFn: (agentUserId: string) => assignProductAgent(productId, { agentUserId }),
    onMutate: (agentUserId) => {
      setAssigningAgentUserId(agentUserId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Vendedor asignado');
    },
    onError: (error) => {
      toast.error(agentAssignmentErrorMessage(error, 'No se pudo asignar el vendedor'));
    },
    onSettled: () => {
      setAssigningAgentUserId(null);
    }
  });
  const removeAgentMutation = useMutation({
    mutationFn: (agentId: string) => removeProductAgent(productId, agentId),
    onMutate: (agentId) => {
      setRemovingAgentId(agentId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Vendedor quitado');
    },
    onError: (error) => {
      toast.error(agentAssignmentErrorMessage(error, 'No se pudo quitar el vendedor'));
    },
    onSettled: () => {
      setRemovingAgentId(null);
    }
  });
  const setPrimaryAgentMutation = useMutation({
    mutationFn: (agentId: string) =>
      setPrimaryProductAgent(productId, { agentId, expectedPrimaryAgentId: primaryAgentId }),
    onSuccess: async (engagement) => {
      queryClient.setQueryData(productKeys.detail(productId, tenantId), engagement);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Vendedor principal actualizado');
    },
    onError: (error) => void handlePrimaryAgentError(error)
  });
  const clearPrimaryAgentMutation = useMutation({
    mutationFn: () =>
      clearPrimaryProductAgent(productId, { expectedPrimaryAgentId: primaryAgentId }),
    onSuccess: async (engagement) => {
      queryClient.setQueryData(productKeys.detail(productId, tenantId), engagement);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Vendedor principal quitado');
    },
    onError: (error) => void handlePrimaryAgentError(error)
  });
  const assignAllAgentsMutation = useMutation({
    mutationFn: async (agentUserIds: string[]) => {
      const results = await Promise.allSettled(
        agentUserIds.map((agentUserId) => assignProductAgent(productId, { agentUserId }))
      );
      const assignedCount = results.filter((result) => result.status === 'fulfilled').length;

      return {
        assignedCount,
        failedCount: results.length - assignedCount,
        totalCount: results.length
      };
    },
    onSuccess: async ({ assignedCount, failedCount }) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });

      if (failedCount === 0) {
        toast.success(getAssignAllAgentsSuccessMessage(assignedCount));
        return;
      }

      if (assignedCount > 0) {
        toast.warning(
          `Se asignaron ${assignedCount} vendedores, pero ${failedCount} no se pudieron sumar.`
        );
        return;
      }

      toast.error('No se pudieron asignar los vendedores. Intentá nuevamente.');
    },
    onError: () => {
      toast.error('No se pudieron asignar los vendedores. Intentá nuevamente.');
    }
  });

  const isSellerMutationPending =
    assignAgentMutation.isPending ||
    removeAgentMutation.isPending ||
    setPrimaryAgentMutation.isPending ||
    clearPrimaryAgentMutation.isPending ||
    assignAllAgentsMutation.isPending;

  async function handlePrimaryAgentError(error: unknown) {
    if (
      hasErrorCode(error, 'PRIMARY_AGENT_STATE_CONFLICT') ||
      hasErrorCode(error, 'PRIMARY_AGENT_CANDIDATE_INVALID')
    ) {
      try {
        await queryClient.invalidateQueries({
          exact: true,
          queryKey: productKeys.detail(productId, tenantId),
          refetchType: 'none'
        });
        await queryClient.fetchQuery(productByIdOptions(productId, tenantId));
      } catch {
        // Keep the last server state if the required refresh cannot complete.
      }
    }
    toast.error(primaryAgentMutationErrorMessage(error));
  }

  function handleOpenAgentsDialog() {
    if (isArchived || !canManageAgents) {
      return;
    }

    setAgentsDialogOpen(true);
  }

  function handleAssignAgent(agentUserId: string) {
    if (isArchived || !canManageAgents || isSellerMutationPending) {
      return;
    }

    assignAgentMutation.mutate(agentUserId);
  }

  function handleAssignAllAgents(agentUserIds: string[]) {
    if (isArchived || !canManageAgents || agentUserIds.length === 0 || isSellerMutationPending) {
      return;
    }

    assignAllAgentsMutation.mutate(agentUserIds);
  }

  function handleRemoveAgent(agentId: string) {
    if (isArchived || !canManageAgents || isSellerMutationPending) {
      return;
    }

    removeAgentMutation.mutate(agentId);
  }

  function handleSetPrimaryAgent(agentId: string) {
    if (isArchived || !canManageAgents || isSellerMutationPending) {
      return;
    }

    setPrimaryAgentMutation.mutate(agentId);
  }

  function handleClearPrimaryAgent() {
    if (primaryAgentId === null || isArchived || !canManageAgents || isSellerMutationPending) {
      return;
    }

    clearPrimaryAgentMutation.mutate();
  }

  return (
    <>
      <PropertyAgentsPanel
        agents={agents}
        canManageAgents={canManageAgents}
        isArchived={isArchived}
        isManageDisabled={isSellerMutationPending}
        onManage={handleOpenAgentsDialog}
      />
      <ManagePropertyAgentsDialog
        open={agentsDialogOpen}
        assignedAgents={agents}
        assignableAgents={assignableAgentsQuery.data?.items ?? []}
        assigningUserId={assigningAgentUserId}
        isAssignableAgentsError={assignableAgentsQuery.isError}
        isAssignableAgentsLoading={assignableAgentsQuery.isLoading}
        isAssigningAllAgents={assignAllAgentsMutation.isPending}
        isPrimaryMutationPending={
          setPrimaryAgentMutation.isPending || clearPrimaryAgentMutation.isPending
        }
        removingAgentId={removingAgentId}
        onAssign={handleAssignAgent}
        onAssignAll={handleAssignAllAgents}
        onClearPrimary={handleClearPrimaryAgent}
        onOpenChange={setAgentsDialogOpen}
        onRemove={handleRemoveAgent}
        onSetPrimary={handleSetPrimaryAgent}
      />
    </>
  );
}

function getAssignAllAgentsSuccessMessage(count: number) {
  if (count === 1) {
    return '1 vendedor asignado';
  }

  return `${count} vendedores asignados`;
}
