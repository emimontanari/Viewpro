import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import { createProductMovement, getProductMovements } from '../api/service';
import type { ProductMovementMutationPayload } from '../api/types';

type UsePropertyMovementsControllerParams = {
  isArchived: boolean;
  productId: string;
  tenantId: string | null;
};

export function usePropertyMovementsController({
  isArchived,
  productId,
  tenantId
}: UsePropertyMovementsControllerParams) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const movementsQuery = useQuery({
    queryKey: productKeys.movements(productId, tenantId),
    queryFn: () => getProductMovements(productId)
  });
  const createMovementMutation = useMutation({
    mutationFn: (payload: ProductMovementMutationPayload) =>
      createProductMovement(productId, payload),
    onSuccess: async (_movement, payload) => {
      setDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: productKeys.movements(productId, tenantId)
        }),
        queryClient.invalidateQueries({
          queryKey: payload.newStatus ? productKeys.all : productKeys.detail(productId, tenantId)
        })
      ]);
      toast.success('Actualización agregada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar la actualización');
    }
  });

  function handleCreateMovement(payload: ProductMovementMutationPayload) {
    if (isArchived || createMovementMutation.isPending) {
      return;
    }

    createMovementMutation.mutate(payload);
  }

  return {
    dialogOpen,
    handleCreateMovement,
    isCreatingMovement: createMovementMutation.isPending,
    isError: movementsQuery.isError,
    isLoading: movementsQuery.isLoading,
    items: movementsQuery.data?.items ?? [],
    setDialogOpen
  };
}
