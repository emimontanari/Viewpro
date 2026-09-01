'use client';

import { messageFor } from '@/lib/bff-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { productKeys } from '../../api/queries';
import { archiveProduct, restoreProduct } from '../../api/service';
import type { ProductListItem } from '../../api/types';
import { Icons } from '@/components/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CellActionProps {
  canManageProperties?: boolean;
  data: ProductListItem;
}

export function CellAction({ canManageProperties = true, data }: CellActionProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isArchived = Boolean(data.archivedAt);
  const LifecycleIcon = isArchived ? Icons.check : Icons.eyeOff;
  const lifecycleLabel = isArchived ? 'Restaurar propiedad' : 'Archivar propiedad';
  const lifecycleMutation = useMutation({
    mutationFn: () => (isArchived ? restoreProduct(data.id) : archiveProduct(data.id)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success(isArchived ? 'Propiedad restaurada' : 'Propiedad archivada');
    },
    onError: (error) => {
      toast.error(messageFor(error, 'No se pudo actualizar la propiedad'));
    }
  });

  function handleLifecycleAction() {
    if (lifecycleMutation.isPending) {
      return;
    }

    lifecycleMutation.mutate();
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-8 w-8 p-0'>
          <span className='sr-only'>Abrir menú</span>
          <Icons.ellipsis className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => router.push(`/dashboard/product/${data.id}`)}>
          <Icons.page className='mr-2 h-4 w-4' /> Ver detalle
        </DropdownMenuItem>
        {canManageProperties ? (
          <>
            <DropdownMenuItem onClick={() => router.push(`/dashboard/product/${data.id}/edit`)}>
              <Icons.edit className='mr-2 h-4 w-4' /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem disabled={lifecycleMutation.isPending} onClick={handleLifecycleAction}>
              {lifecycleMutation.isPending ? (
                <Icons.spinner className='mr-2 h-4 w-4 animate-spin' />
              ) : (
                <LifecycleIcon className='mr-2 h-4 w-4' />
              )}
              {lifecycleMutation.isPending ? 'Guardando...' : lifecycleLabel}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
