'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { assignableProductAgentsOptions, productKeys } from '../api/queries';
import { assignProductAgent, removeProductAgent } from '../api/service';
import type { ProductAgent } from '../api/types';
import { ManagePropertyAgentsDialog, PropertyAgentsPanel } from './manage-property-agents-dialog';

type PropertyAgentsSectionProps = {
  agents: ProductAgent[];
  isArchived: boolean;
  productId: string;
  tenantId: string | null;
};

export function PropertyAgentsSection({
  agents,
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
    enabled: agentsDialogOpen && !isArchived
  });
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
      toast.error(getAgentAssignmentErrorMessage(error, 'No se pudo asignar el vendedor'));
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
      toast.error(getAgentAssignmentErrorMessage(error, 'No se pudo quitar el vendedor'));
    },
    onSettled: () => {
      setRemovingAgentId(null);
    }
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

  function handleOpenAgentsDialog() {
    if (isArchived) {
      return;
    }

    setAgentsDialogOpen(true);
  }

  function handleAssignAgent(agentUserId: string) {
    if (
      isArchived ||
      assignAgentMutation.isPending ||
      removeAgentMutation.isPending ||
      assignAllAgentsMutation.isPending
    ) {
      return;
    }

    assignAgentMutation.mutate(agentUserId);
  }

  function handleAssignAllAgents(agentUserIds: string[]) {
    if (
      isArchived ||
      agentUserIds.length === 0 ||
      assignAgentMutation.isPending ||
      removeAgentMutation.isPending ||
      assignAllAgentsMutation.isPending
    ) {
      return;
    }

    assignAllAgentsMutation.mutate(agentUserIds);
  }

  function handleRemoveAgent(agentId: string) {
    if (
      isArchived ||
      assignAgentMutation.isPending ||
      removeAgentMutation.isPending ||
      assignAllAgentsMutation.isPending
    ) {
      return;
    }

    removeAgentMutation.mutate(agentId);
  }

  return (
    <>
      <PropertyAgentsPanel
        agents={agents}
        isArchived={isArchived}
        isManageDisabled={
          assignAgentMutation.isPending ||
          removeAgentMutation.isPending ||
          assignAllAgentsMutation.isPending
        }
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
        removingAgentId={removingAgentId}
        onAssign={handleAssignAgent}
        onAssignAll={handleAssignAllAgents}
        onOpenChange={setAgentsDialogOpen}
        onRemove={handleRemoveAgent}
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

function getAgentAssignmentErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.includes('already assigned')) {
    return 'El vendedor ya está asignado a esta propiedad.';
  }

  return error.message || fallback;
}
