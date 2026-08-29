'use client';

import { messageFor } from '@/lib/bff-client';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { productKeys } from '../api/queries';
import { setProductImageAsPrimary } from '../api/service';
import type { PropertyImage } from '../api/types';
import { PropertyImagePreview } from './property-images';

export function DeletePropertyImageDialog({
  image,
  loading,
  open,
  onConfirm,
  onOpenChange
}: {
  image: PropertyImage | null;
  loading: boolean;
  open: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className='sm:max-w-md'>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar imagen</AlertDialogTitle>
          <AlertDialogDescription>
            Esta imagen se quitará de la propiedad{image ? ` (${image.originalFilename})` : ''}.
            Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <Button
            type='button'
            variant='destructive'
            isLoading={loading}
            onClick={onConfirm}
            className='min-w-32'
          >
            Eliminar imagen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PropertyImagePreviewDialog({
  engagementId,
  image,
  open,
  onPrimaryChange,
  onOpenChange
}: {
  engagementId?: string;
  image: PropertyImage | null;
  open: boolean;
  onPrimaryChange: (image: PropertyImage) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const setPrimaryMutation = useMutation({
    mutationFn: async () => {
      if (!engagementId || !image) {
        throw new Error('PRIMARY_IMAGE_UNAVAILABLE');
      }

      return setProductImageAsPrimary(engagementId, image.id);
    },
    onSuccess: async (updatedImage) => {
      onPrimaryChange(updatedImage);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Imagen principal actualizada');
    },
    onError: (error) => {
      toast.error(
        messageFor(error, 'No se pudo marcar la imagen como principal')
      );
    }
  });
  const canSetPrimary = Boolean(engagementId && image && !image.isPrimary);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl gap-4 p-4 sm:p-6'>
        <DialogHeader className='pr-8'>
          <DialogTitle>Vista previa de imagen</DialogTitle>
          <DialogDescription>
            {image?.originalFilename ?? 'Imagen de la propiedad'}
          </DialogDescription>
        </DialogHeader>
        <div className='relative flex min-h-[18rem] items-center justify-center overflow-hidden rounded-xl border bg-muted md:min-h-[32rem]'>
          {image ? (
            <PropertyImagePreview
              key={image.id}
              src={image.url}
              alt={image.originalFilename}
              className='max-h-[72vh] w-full object-contain'
              fallbackClassName='min-h-[18rem] md:min-h-[32rem]'
            />
          ) : null}
        </div>
        {image && engagementId ? (
          <div className='flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-1'>
              <p className='text-sm font-medium'>Imagen de portada</p>
              <p className='text-xs text-muted-foreground'>
                La imagen principal aparece primero en la ficha y en el listado.
              </p>
            </div>
            <Button
              type='button'
              size='sm'
              variant={image.isPrimary ? 'secondary' : 'default'}
              disabled={!canSetPrimary || setPrimaryMutation.isPending}
              isLoading={setPrimaryMutation.isPending}
              onClick={() => setPrimaryMutation.mutate()}
              className='shrink-0'
            >
              {image.isPrimary ? 'Imagen principal' : 'Poner como principal'}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
