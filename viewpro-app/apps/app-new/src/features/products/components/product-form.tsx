'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Icons } from '@/components/icons';
import { assignableProductAgentsOptions, productKeys } from '../api/queries';
import {
  createProduct,
  assignProductAgent,
  createProductMovement,
  createProductOwnerInvitationLink,
  deleteProductImage,
  getProductMovements,
  linkProductOwner,
  removeProductAgent,
  restoreProduct,
  setProductImageAsPrimary,
  updateProduct,
  uploadProductImage
} from '../api/service';
import type {
  LinkProductOwnerPayload,
  Product,
  ProductMovementMutationPayload,
  ProductMutationPayload,
  PropertyImage,
  PropertyLinkedOwner
} from '../api/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';
import {
  productSchema,
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_FILES,
  type ProductFormValues
} from '@/features/products/schemas/product';
import {
  currencyOptions,
  operationTypeOptions,
  propertyTypeOptions
} from '@/features/products/constants/product-options';
import { formatDateTime } from '../utils/format-date-time';
import { CreatePropertyMovementDialog } from './create-property-movement-dialog';
import { LinkPropertyOwnerDialog } from './link-property-owner-dialog';
import { ManagePropertyAgentsDialog, PropertyAgentsPanel } from './manage-property-agents-dialog';
import { PropertyOwnerCard } from './property-owner-card';
import { PropertyMovementHistory } from './property-movement-history';
import { PropertyDocumentRequests } from './property-document-requests';
import { QuickStatusSelect } from './quick-status-select';
import {
  getAddress,
  getArchivedTone,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyFacts,
  getPropertyTypeLabel,
  getStatusLabel,
  getStatusTone,
  isArchivedProduct
} from './product-tables/columns';
import { cn } from '@/lib/utils';

const PROPERTY_IMAGE_ACCEPT = {
  'image/jpeg': [],
  'image/png': [],
  'image/webp': []
};

type ProductFormMode = 'create' | 'detail' | 'edit';

export default function ProductForm({
  initialData,
  mode = initialData ? 'detail' : 'create',
  pageTitle
}: {
  initialData: Product | null;
  mode?: ProductFormMode;
  pageTitle: string;
}) {
  if (mode === 'detail' && initialData) {
    return <PropertyEngagementDetails propertyEngagement={initialData} pageTitle={pageTitle} />;
  }

  return <PropertyEngagementEditor initialData={initialData} mode={mode} pageTitle={pageTitle} />;
}

function PropertyEngagementEditor({
  initialData,
  mode,
  pageTitle
}: {
  initialData: Product | null;
  mode: ProductFormMode;
  pageTitle: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = mode === 'edit' && Boolean(initialData);
  const existingImageCount = initialData?.property.images.length ?? 0;
  const availableImageSlots = isEditMode
    ? Math.max(PROPERTY_IMAGE_MAX_FILES - existingImageCount, 0)
    : PROPERTY_IMAGE_MAX_FILES;
  const [imagePendingDeletion, setImagePendingDeletion] = useState<PropertyImage | null>(null);
  const [imagePreview, setImagePreview] = useState<PropertyImage | null>(null);
  const cancelHref =
    isEditMode && initialData ? `/dashboard/product/${initialData.id}` : '/dashboard/product';
  const cancelLabel = isEditMode ? 'Cancelar edición' : 'Cancelar';
  const submitLabel = isEditMode ? 'Guardar cambios' : 'Crear propiedad';

  const deleteImageMutation = useMutation({
    mutationFn: async (image: PropertyImage) => {
      if (!isEditMode || !initialData) {
        throw new Error('DELETE_UNAVAILABLE');
      }

      await deleteProductImage(initialData.id, image.id);
      return image;
    },
    onSuccess: async () => {
      setImagePendingDeletion(null);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Imagen eliminada correctamente');
    },
    onError: () => {
      toast.error('No se pudo eliminar la imagen');
    }
  });

  function handleDeleteImage(image: PropertyImage) {
    setImagePendingDeletion(image);
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    if (!open && !deleteImageMutation.isPending) {
      setImagePendingDeletion(null);
    }
  }

  function confirmDeleteImage() {
    if (imagePendingDeletion) {
      deleteImageMutation.mutate(imagePendingDeletion);
    }
  }

  const mutation = useMutation({
    mutationFn: async (value: ProductFormValues) => {
      const images = value.image ?? [];

      if (images.length > availableImageSlots) {
        throw new Error('IMAGE_LIMIT_EXCEEDED');
      }

      if (isEditMode && initialData) {
        const updatedProperty = await updateProduct(initialData.id, toUpdatePayload(value));
        const imageUploadFailures = await uploadSelectedImages(updatedProperty.id, images);
        return {
          imageUploadCount: Math.max(images.length - imageUploadFailures, 0),
          imageUploadFailures,
          propertyId: updatedProperty.id,
          type: 'edit' as const
        };
      }

      const createdProperty = await createProduct(toCreatePayload(value));
      const imageUploadFailures = await uploadSelectedImages(createdProperty.id, images);
      return {
        imageUploadCount: Math.max(images.length - imageUploadFailures, 0),
        imageUploadFailures,
        propertyId: createdProperty.id,
        type: 'create' as const
      };
    },
    onSuccess: async ({ imageUploadCount, imageUploadFailures, propertyId, type }) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });

      if (imageUploadFailures > 0) {
        toast.warning(
          imageUploadFailures === 1
            ? 'La propiedad se guardó, pero no se pudo subir una imagen.'
            : `La propiedad se guardó, pero no se pudieron subir ${imageUploadFailures} imágenes.`
        );
      } else {
        toast.success(getPropertySaveSuccessMessage(type, imageUploadCount));
      }

      router.push(type === 'edit' ? `/dashboard/product/${propertyId}` : '/dashboard/product');
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'IMAGE_LIMIT_EXCEEDED') {
        toast.error('La propiedad puede tener hasta 5 imágenes.');
        return;
      }

      toast.error(isEditMode ? 'No se pudo editar la propiedad' : 'No se pudo crear la propiedad');
    }
  });

  const form = useAppForm({
    defaultValues: getDefaultValues(initialData),
    validators: {
      onSubmit: productSchema
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value).catch(() => undefined);
    }
  });

  const { FormTextField, FormSelectField, FormFileUploadField } =
    useFormFields<ProductFormValues>();

  return (
    <Card className='mx-auto w-full overflow-hidden'>
      <CardHeader className='border-b bg-muted/20'>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Actualizá los datos comerciales, el precio y las imágenes de la propiedad.'
            : 'Cargá los datos mínimos para publicar y administrar la propiedad.'}
        </CardDescription>
      </CardHeader>
      <CardContent className='p-4 sm:p-6'>
        <form.AppForm>
          <form.Form className='space-y-8' onKeyDown={preventAccidentalEnterSubmit}>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
              <FormTextField
                name='title'
                label='Título'
                required
                placeholder='Departamento en Palermo'
                validators={{
                  onBlur: z.string().min(2, 'El título debe tener al menos 2 caracteres.')
                }}
              />

              <FormSelectField
                name='propertyType'
                label='Tipo de propiedad'
                required
                options={propertyTypeOptions}
                placeholder='Seleccioná un tipo'
              />

              <FormTextField
                name='addressLine'
                label='Dirección'
                required
                placeholder='Av. Santa Fe 1234'
                validators={{
                  onBlur: z.string().min(2, 'La dirección es obligatoria.')
                }}
              />

              <FormTextField
                name='city'
                label='Ciudad'
                required
                placeholder='CABA'
                validators={{
                  onBlur: z.string().min(2, 'La ciudad es obligatoria.')
                }}
              />

              <FormTextField
                name='province'
                label='Provincia'
                required
                placeholder='Buenos Aires'
                validators={{
                  onBlur: z.string().min(2, 'La provincia es obligatoria.')
                }}
              />

              <FormSelectField
                name='operationType'
                label='Operación'
                required
                options={operationTypeOptions}
                placeholder='Seleccioná una operación'
              />

              <form.AppField
                name='publishedPrice'
                children={(field) => {
                  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                  return (
                    <field.FieldSet>
                      <field.Field>
                        <field.FieldLabel htmlFor={field.name}>Precio publicado</field.FieldLabel>
                        <Input
                          id={field.name}
                          inputMode='numeric'
                          placeholder='125.000'
                          value={formatAmountInput(field.state.value)}
                          onBlur={field.handleBlur}
                          onChange={(event) => {
                            field.handleChange(parseAmountInput(event.target.value));
                          }}
                          aria-invalid={isInvalid}
                        />
                        <field.FieldDescription>
                          Se formatea automáticamente para que no te pierdas con los ceros.
                        </field.FieldDescription>
                      </field.Field>
                      <field.FieldError />
                    </field.FieldSet>
                  );
                }}
              />

              <FormSelectField
                name='currency'
                label='Moneda'
                options={currencyOptions}
                placeholder='Seleccioná una moneda'
              />

              <div className='md:col-span-2 rounded-xl border bg-muted/20 p-4'>
                <div className='space-y-1'>
                  <h3 className='text-sm font-semibold'>Características</h3>
                  <p className='text-xs text-muted-foreground'>
                    Datos físicos opcionales de la propiedad. Podés completarlos ahora o más
                    adelante.
                  </p>
                </div>
                <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
                  <FormTextField
                    name='totalAreaSqm'
                    label='Superficie total'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='360'
                    description='m² totales'
                  />
                  <FormTextField
                    name='coveredAreaSqm'
                    label='Superficie cubierta'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='231'
                    description='m² cubiertos'
                  />
                  <FormTextField
                    name='rooms'
                    label='Ambientes'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='5'
                  />
                  <FormTextField
                    name='bedrooms'
                    label='Dormitorios'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='3'
                  />
                  <FormTextField
                    name='bathrooms'
                    label='Baños'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='2'
                  />
                  <FormTextField
                    name='garages'
                    label='Cocheras'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='1'
                  />
                  <FormTextField
                    name='ageYears'
                    label='Antigüedad'
                    type='number'
                    min={0}
                    step={1}
                    placeholder='10'
                    description='Años'
                  />
                  <FormTextField
                    name='orientation'
                    label='Orientación'
                    placeholder='NE'
                    validators={{
                      onBlur: z.string().max(16, 'La orientación no puede superar 16 caracteres.')
                    }}
                  />
                </div>
              </div>

              <FormTextField
                name='ownerName'
                label='Propietario'
                placeholder='Nombre del propietario'
              />

              <FormTextField
                name='ownerEmail'
                label='Email del propietario'
                type='email'
                placeholder='propietario@email.com'
              />

              <section className='space-y-4 rounded-2xl border bg-muted/10 p-4 md:col-span-2'>
                <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                  <div className='space-y-1'>
                    <h3 className='text-sm font-semibold'>Galería de imágenes</h3>
                    <p className='text-xs text-muted-foreground'>
                      Las fotos se suben al guardar la propiedad. Si una imagen viene marcada como
                      principal, la señalamos en la galería.
                    </p>
                  </div>
                  <Badge variant='outline' className='w-fit rounded-full bg-background'>
                    {existingImageCount} / {PROPERTY_IMAGE_MAX_FILES} cargadas
                  </Badge>
                </div>
                <div className='h-2 overflow-hidden rounded-full bg-muted'>
                  <div
                    className='h-full rounded-full bg-primary transition-all'
                    style={{
                      width: `${Math.min((existingImageCount / PROPERTY_IMAGE_MAX_FILES) * 100, 100)}%`
                    }}
                  />
                </div>

                {isEditMode && initialData ? (
                  <ExistingImagesSummary
                    images={initialData.property.images}
                    onDeleteImage={handleDeleteImage}
                    onPreviewImage={setImagePreview}
                    pendingDeleteImageId={
                      deleteImageMutation.isPending ? deleteImageMutation.variables?.id : undefined
                    }
                  />
                ) : null}
                {availableImageSlots > 0 ? (
                  <div className='rounded-xl border bg-background p-4'>
                    <FormFileUploadField
                      name='image'
                      label={isEditMode ? 'Sumar nuevas imágenes' : 'Imágenes iniciales'}
                      description={getImageUploadDescription(availableImageSlots)}
                      maxFiles={availableImageSlots}
                      maxSize={PROPERTY_IMAGE_MAX_BYTES}
                      accept={PROPERTY_IMAGE_ACCEPT}
                    />
                  </div>
                ) : (
                  <div className='rounded-xl border border-dashed bg-background p-4 text-sm text-muted-foreground'>
                    La galería ya tiene el máximo de {PROPERTY_IMAGE_MAX_FILES} imágenes. Eliminá
                    una foto existente si necesitás subir otra.
                  </div>
                )}
              </section>
            </div>

            <div className='flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-end'>
              {mutation.isPending ? (
                <Button type='button' variant='outline' disabled>
                  {cancelLabel}
                </Button>
              ) : (
                <Button asChild variant='outline'>
                  <Link href={cancelHref}>{cancelLabel}</Link>
                </Button>
              )}
              <form.SubmitButton disabled={mutation.isPending}>{submitLabel}</form.SubmitButton>
            </div>
          </form.Form>
        </form.AppForm>
        <DeletePropertyImageDialog
          image={imagePendingDeletion}
          loading={deleteImageMutation.isPending}
          open={Boolean(imagePendingDeletion)}
          onConfirm={confirmDeleteImage}
          onOpenChange={handleDeleteDialogOpenChange}
        />
        <PropertyImagePreviewDialog
          engagementId={initialData?.id}
          image={imagePreview}
          open={Boolean(imagePreview)}
          onPrimaryChange={setImagePreview}
          onOpenChange={(open) => {
            if (!open) {
              setImagePreview(null);
            }
          }}
        />
      </CardContent>
    </Card>
  );
}

function preventAccidentalEnterSubmit(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
    return;
  }

  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const tagName = target.tagName.toLowerCase();
  const inputType = target instanceof HTMLInputElement ? target.type : '';
  const shouldPrevent =
    tagName === 'textarea' ? false : tagName === 'input' && inputType !== 'file';

  if (shouldPrevent) {
    event.preventDefault();
  }
}

function DeletePropertyImageDialog({
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

function PropertyImagePreviewDialog({
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
        error instanceof Error ? error.message : 'No se pudo marcar la imagen como principal'
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

function PropertyEngagementDetails({
  propertyEngagement,
  pageTitle
}: {
  propertyEngagement: Product;
  pageTitle: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [agentsDialogOpen, setAgentsDialogOpen] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [assigningAgentUserId, setAssigningAgentUserId] = useState<string | null>(null);
  const [removingAgentId, setRemovingAgentId] = useState<string | null>(null);
  const [copyingInvitationOwnerId, setCopyingInvitationOwnerId] = useState<string | null>(null);
  const [manualInvitationFallback, setManualInvitationFallback] = useState<{
    ownerId: string;
    invitationUrl: string;
  } | null>(null);
  const isArchived = isArchivedProduct(propertyEngagement);
  const address = getAddress(propertyEngagement) || 'Sin dirección cargada';
  const propertyFacts = getPropertyFacts(propertyEngagement);
  const movementsQuery = useQuery({
    queryKey: productKeys.movements(propertyEngagement.id, propertyEngagement.tenantId),
    queryFn: () => getProductMovements(propertyEngagement.id)
  });
  const assignableAgentsQuery = useQuery({
    ...assignableProductAgentsOptions(propertyEngagement.tenantId),
    enabled: agentsDialogOpen && !isArchived
  });
  const restoreMutation = useMutation({
    mutationFn: () => restoreProduct(propertyEngagement.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Propiedad restaurada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo restaurar la propiedad');
    }
  });
  const createMovementMutation = useMutation({
    mutationFn: (payload: ProductMovementMutationPayload) =>
      createProductMovement(propertyEngagement.id, payload),
    onSuccess: async (_movement, payload) => {
      setMovementDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: productKeys.movements(propertyEngagement.id, propertyEngagement.tenantId)
        }),
        queryClient.invalidateQueries({
          queryKey: payload.newStatus
            ? productKeys.all
            : productKeys.detail(propertyEngagement.id, propertyEngagement.tenantId)
        })
      ]);
      toast.success('Actualización agregada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'No se pudo agregar la actualización');
    }
  });
  const assignAgentMutation = useMutation({
    mutationFn: (agentUserId: string) => assignProductAgent(propertyEngagement.id, { agentUserId }),
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
    mutationFn: (agentId: string) => removeProductAgent(propertyEngagement.id, agentId),
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
        agentUserIds.map((agentUserId) =>
          assignProductAgent(propertyEngagement.id, { agentUserId })
        )
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
  const linkOwnerMutation = useMutation({
    mutationFn: (payload: LinkProductOwnerPayload) =>
      linkProductOwner(propertyEngagement.id, payload),
    onSuccess: async () => {
      setOwnerDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      toast.success('Propietario vinculado');
    },
    onError: (error) => {
      toast.error(getOwnerLinkErrorMessage(error));
    }
  });

  function handleRestoreProperty() {
    if (restoreMutation.isPending) {
      return;
    }

    restoreMutation.mutate();
  }

  function handleCreateMovement(payload: ProductMovementMutationPayload) {
    if (isArchived || createMovementMutation.isPending) {
      return;
    }

    createMovementMutation.mutate(payload);
  }

  function handleOpenAgentsDialog() {
    if (isArchived) {
      return;
    }

    setAgentsDialogOpen(true);
  }

  function handleOpenOwnerDialog() {
    if (isArchived || linkOwnerMutation.isPending) {
      return;
    }

    setOwnerDialogOpen(true);
  }

  function handleLinkOwner(payload: LinkProductOwnerPayload) {
    if (isArchived || linkOwnerMutation.isPending) {
      return;
    }

    linkOwnerMutation.mutate(payload);
  }

  async function handleCopyInvitationLink(owner: PropertyLinkedOwner) {
    if (isArchived || copyingInvitationOwnerId) {
      return;
    }

    setCopyingInvitationOwnerId(owner.id);
    setManualInvitationFallback(null);

    try {
      const response = await createProductOwnerInvitationLink(propertyEngagement.id, owner.id);

      try {
        await navigator.clipboard.writeText(response.invitationUrl);
        toast.success('Link de invitación copiado. Los links anteriores ya no funcionan.');
      } catch {
        setManualInvitationFallback({ ownerId: owner.id, invitationUrl: response.invitationUrl });
        toast.warning('No pudimos copiar automáticamente. Copiá el link manualmente.');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo generar el link de invitación.'
      );
    } finally {
      setCopyingInvitationOwnerId(null);
    }
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
    <Card className='mx-auto w-full overflow-hidden'>
      <CardHeader className='border-b bg-muted/20'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div className='min-w-0 space-y-3'>
            <div className='flex flex-wrap gap-2'>
              <Badge
                variant='outline'
                className={cn('rounded-full', getOperationTone(propertyEngagement.operationType))}
              >
                {getOperationTypeLabel(propertyEngagement.operationType)}
              </Badge>
              <Badge
                variant='outline'
                className={cn('rounded-full', getStatusTone(propertyEngagement.status))}
              >
                {getStatusLabel(propertyEngagement.status)}
              </Badge>
              <Badge variant='outline' className='rounded-full bg-background/70'>
                {getPropertyTypeLabel(propertyEngagement.property.propertyType)}
              </Badge>
              {isArchived ? (
                <Badge variant='outline' className={cn('rounded-full', getArchivedTone())}>
                  Archivada
                </Badge>
              ) : null}
            </div>
            <div className='space-y-1'>
              <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                {pageTitle}
              </p>
              <CardTitle className='break-words text-left text-2xl font-bold md:text-3xl'>
                {propertyEngagement.property.title}
              </CardTitle>
              <p className='break-words text-sm text-muted-foreground'>{address}</p>
              {propertyFacts ? (
                <p className='text-sm font-medium text-muted-foreground'>{propertyFacts}</p>
              ) : null}
            </div>
          </div>

          <div className='flex shrink-0 flex-col gap-2 sm:flex-row lg:justify-end'>
            <Button
              type='button'
              variant='outline'
              onClick={() => router.push('/dashboard/product')}
            >
              Volver al listado
            </Button>
            {isArchived ? (
              <>
                <Button
                  type='button'
                  variant='secondary'
                  disabled={restoreMutation.isPending}
                  isLoading={restoreMutation.isPending}
                  onClick={handleRestoreProperty}
                >
                  <Icons.check className='mr-2 size-4' />
                  Restaurar propiedad
                </Button>
                <p className='max-w-56 text-xs leading-5 text-muted-foreground'>
                  Restaurá la propiedad para agregar actualizaciones.
                </p>
              </>
            ) : (
              <Button
                type='button'
                variant='secondary'
                disabled={createMovementMutation.isPending}
                onClick={() => setMovementDialogOpen(true)}
              >
                <Icons.add className='mr-2 size-4' />
                Agregar actualización
              </Button>
            )}
            <Button
              type='button'
              onClick={() => router.push(`/dashboard/product/${propertyEngagement.id}/edit`)}
            >
              <Icons.edit className='mr-2 size-4' />
              Editar propiedad
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className='space-y-6 p-4 sm:p-6'>
        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]'>
          <PropertyImageCarousel
            images={getCarouselImages(propertyEngagement)}
            title={propertyEngagement.property.title}
          />

          <aside className='flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-xs sm:p-4'>
            <div className='rounded-xl border bg-muted/20 p-5'>
              <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                Precio publicado
              </div>
              <div className='mt-3 text-4xl font-bold tracking-tight'>
                {formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
              </div>
              <p className='mt-2 text-xs text-muted-foreground'>
                Moneda: {propertyEngagement.currency ?? 'ARS'}
              </p>
            </div>

            <ReadOnlyStatusField propertyEngagement={propertyEngagement} />

            {isArchived ? (
              <ArchivedStatePanel
                archivedAt={propertyEngagement.archivedAt}
                archiveReason={propertyEngagement.archiveReason}
              />
            ) : null}

            <PropertyOwnerCard
              copyingInvitationOwnerId={copyingInvitationOwnerId}
              isArchived={isArchived}
              isLinkDisabled={linkOwnerMutation.isPending}
              manualInvitationFallback={manualInvitationFallback}
              ownerEmail={propertyEngagement.property.ownerEmail}
              ownerName={propertyEngagement.property.ownerName}
              owners={propertyEngagement.property.owners}
              onCopyInvitationLink={handleCopyInvitationLink}
              onLinkOwner={handleOpenOwnerDialog}
            />

            <PropertyAgentsPanel
              agents={propertyEngagement.agents}
              isArchived={isArchived}
              isManageDisabled={
                assignAgentMutation.isPending ||
                removeAgentMutation.isPending ||
                assignAllAgentsMutation.isPending
              }
              onManage={handleOpenAgentsDialog}
            />
          </aside>
        </div>

        <section className='space-y-3'>
          <div>
            <h3 className='text-base font-semibold'>Información principal</h3>
            <p className='text-sm text-muted-foreground'>
              Datos base para identificar y publicar la propiedad.
            </p>
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <ReadOnlyField
              label='Tipo'
              value={getPropertyTypeLabel(propertyEngagement.property.propertyType)}
            />
            <ReadOnlyField
              label='Operación'
              value={getOperationTypeLabel(propertyEngagement.operationType)}
            />
            <ReadOnlyField label='Dirección' value={propertyEngagement.property.addressLine} />
            <ReadOnlyField
              label='Localidad'
              value={`${propertyEngagement.property.city}, ${propertyEngagement.property.province}`}
            />
          </div>
        </section>

        <section className='space-y-3'>
          <div>
            <h3 className='text-base font-semibold'>Características</h3>
            <p className='text-sm text-muted-foreground'>
              Datos físicos registrados para esta propiedad.
            </p>
          </div>
          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <ReadOnlyField
              label='Superficie total'
              value={formatNumberWithSuffix(propertyEngagement.property.totalAreaSqm, 'm²')}
            />
            <ReadOnlyField
              label='Superficie cubierta'
              value={formatNumberWithSuffix(propertyEngagement.property.coveredAreaSqm, 'm²')}
            />
            <ReadOnlyField
              label='Ambientes'
              value={formatOptionalNumber(propertyEngagement.property.rooms)}
            />
            <ReadOnlyField
              label='Dormitorios'
              value={formatOptionalNumber(propertyEngagement.property.bedrooms)}
            />
            <ReadOnlyField
              label='Baños'
              value={formatOptionalNumber(propertyEngagement.property.bathrooms)}
            />
            <ReadOnlyField
              label='Cocheras'
              value={formatOptionalNumber(propertyEngagement.property.garages)}
            />
            <ReadOnlyField
              label='Antigüedad'
              value={formatNumberWithSuffix(propertyEngagement.property.ageYears, 'años')}
            />
            <ReadOnlyField
              label='Orientación'
              value={propertyEngagement.property.orientation ?? 'Sin dato'}
            />
          </div>
        </section>

        <PropertyMovementHistory
          isError={movementsQuery.isError}
          isLoading={movementsQuery.isLoading}
          movements={movementsQuery.data?.items ?? []}
        />

        <PropertyDocumentRequests
          isArchived={isArchived}
          owners={propertyEngagement.property.owners}
          productId={propertyEngagement.id}
          tenantId={propertyEngagement.tenantId}
        />
      </CardContent>
      <CreatePropertyMovementDialog
        open={movementDialogOpen}
        isSubmitting={createMovementMutation.isPending}
        onOpenChange={setMovementDialogOpen}
        onSubmit={handleCreateMovement}
      />
      <LinkPropertyOwnerDialog
        open={ownerDialogOpen}
        isSubmitting={linkOwnerMutation.isPending}
        onOpenChange={setOwnerDialogOpen}
        onSubmit={handleLinkOwner}
      />
      <ManagePropertyAgentsDialog
        open={agentsDialogOpen}
        assignedAgents={propertyEngagement.agents}
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
    </Card>
  );
}

function ArchivedStatePanel({
  archivedAt,
  archiveReason
}: {
  archivedAt: string | null;
  archiveReason: string | null;
}) {
  return (
    <div className='space-y-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200'>
      <div className='flex items-center gap-2'>
        <Icons.eyeOff className='size-4' />
        <div className='text-xs font-medium uppercase tracking-wide'>Archivada</div>
      </div>
      <div className='space-y-2 text-sm'>
        <div>
          <span className='font-medium'>Fecha: </span>
          {formatDateTime(archivedAt)}
        </div>
        {archiveReason ? (
          <div>
            <span className='font-medium'>Motivo: </span>
            <span className='break-words'>{archiveReason}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PropertyImagePreview({
  alt,
  className,
  fallbackClassName,
  src
}: {
  alt: string;
  className?: string;
  fallbackClassName?: string;
  src: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        role='img'
        aria-label={`${alt} no disponible`}
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-muted text-center text-xs text-muted-foreground',
          className,
          fallbackClassName
        )}
      >
        <Icons.media className='size-4 opacity-70' />
        <span className='leading-tight'>Imagen no disponible</span>
      </div>
    );
  }

  // oxlint-disable-next-line next/no-img-element -- property uploads are served by the authenticated app/API flow; keep a plain img so fallback handling stays local and predictable.
  return <img src={src} alt={alt} className={className} onError={() => setHasError(true)} />;
}

function PropertyImageCarousel({ images, title }: { images: PropertyImage[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

  if (!activeImage) {
    return (
      <div className='flex min-h-[22rem] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground'>
        <div className='rounded-full bg-background p-4 shadow-xs'>
          <Icons.media className='size-8 opacity-70' />
        </div>
        <div className='space-y-1'>
          <p className='font-medium text-foreground'>Sin imágenes cargadas</p>
          <p>Agregá fotos desde edición para completar la ficha visual de la propiedad.</p>
        </div>
      </div>
    );
  }

  const hasMultipleImages = images.length > 1;
  const shouldCenterThumbnails = images.length <= 3;

  function showPreviousImage() {
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  }

  function showNextImage() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  return (
    <div className='space-y-3'>
      <div className='relative min-h-[23rem] w-full overflow-hidden rounded-2xl border bg-muted shadow-xs'>
        <PropertyImagePreview
          key={activeImage.id}
          src={activeImage.url}
          alt={`Imagen ${activeIndex + 1} de ${images.length} de ${title}`}
          className='absolute inset-0 h-full w-full object-cover'
          fallbackClassName='p-4'
        />
        <div className='absolute left-3 top-3 flex flex-wrap gap-2'>
          <Badge className='rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur'>
            {activeIndex + 1} / {images.length}
          </Badge>
          {activeImage.isPrimary ? (
            <Badge className='rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur'>
              Principal
            </Badge>
          ) : null}
        </div>
        {hasMultipleImages ? (
          <>
            <Button
              type='button'
              variant='secondary'
              size='icon'
              className='absolute left-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background'
              onClick={showPreviousImage}
            >
              <Icons.chevronLeft className='size-5' />
              <span className='sr-only'>Imagen anterior</span>
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='icon'
              className='absolute right-3 top-1/2 size-10 -translate-y-1/2 rounded-full bg-background/90 shadow-sm backdrop-blur hover:bg-background'
              onClick={showNextImage}
            >
              <Icons.chevronRight className='size-5' />
              <span className='sr-only'>Imagen siguiente</span>
            </Button>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div
          className={cn(
            'flex justify-start gap-3 overflow-x-auto pb-1',
            shouldCenterThumbnails ? 'sm:justify-center' : 'sm:justify-start'
          )}
        >
          {images.map((image, index) => (
            <button
              key={image.id}
              type='button'
              aria-label={`Ver imagen ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : undefined}
              className={cn(
                'group relative h-20 w-36 flex-none snap-start overflow-hidden rounded-xl border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-40',
                index === activeIndex
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'hover:border-foreground/30'
              )}
              onClick={() => setActiveIndex(index)}
            >
              <PropertyImagePreview
                src={image.url}
                alt={`Miniatura ${index + 1} de ${title}`}
                className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]'
                fallbackClassName='p-2 text-[10px]'
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExistingImagesSummary({
  images,
  onDeleteImage,
  onPreviewImage,
  pendingDeleteImageId
}: {
  images: PropertyImage[];
  onDeleteImage: (image: PropertyImage) => void;
  onPreviewImage: (image: PropertyImage) => void;
  pendingDeleteImageId?: string;
}) {
  if (images.length === 0) {
    return (
      <div className='flex items-center gap-3 rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground'>
        <div className='rounded-full bg-background p-2 shadow-xs'>
          <Icons.media className='size-4' />
        </div>
        <div>
          <p className='font-medium text-foreground'>Todavía no hay imágenes</p>
          <p>Subí hasta {PROPERTY_IMAGE_MAX_FILES} fotos para armar la galería de la propiedad.</p>
        </div>
      </div>
    );
  }

  return (
    <div className='rounded-xl border bg-muted/20 p-4'>
      <div className='mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h3 className='text-sm font-semibold'>Imágenes actuales</h3>
          <p className='text-xs text-muted-foreground'>
            {images.length} de {PROPERTY_IMAGE_MAX_FILES} imágenes cargadas. Tocá una miniatura para
            verla grande o usá la X para quitarla.
          </p>
        </div>
      </div>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5'>
        {images.map((image) => {
          const isDeleting = pendingDeleteImageId === image.id;

          return (
            <div
              key={image.id}
              className='group relative h-28 overflow-hidden rounded-xl border bg-muted shadow-xs transition hover:border-foreground/20 hover:shadow-sm'
            >
              <button
                type='button'
                className='absolute inset-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                onClick={() => onPreviewImage(image)}
              >
                <PropertyImagePreview
                  src={image.url}
                  alt={image.originalFilename}
                  className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]'
                  fallbackClassName='p-3 text-[11px]'
                />
                {image.isPrimary ? (
                  <Badge className='absolute left-1.5 top-1.5 rounded-full bg-background/85 text-[10px] text-foreground shadow-sm backdrop-blur'>
                    Principal
                  </Badge>
                ) : null}
                <span className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-2 pb-2 pt-6 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100'>
                  Ver imagen
                </span>
                <span className='sr-only'>Ver imagen {image.originalFilename}</span>
              </button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-1.5 top-1.5 z-10 size-9 rounded-full border border-destructive/70 bg-background/85 text-destructive shadow-xs backdrop-blur hover:border-destructive hover:bg-destructive/90 hover:text-white focus-visible:ring-destructive/30'
                disabled={isDeleting}
                isLoading={isDeleting}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteImage(image);
                }}
              >
                <Icons.close className='size-4' />
                <span className='sr-only'>Eliminar imagen {image.originalFilename}</span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadOnlyStatusField({ propertyEngagement }: { propertyEngagement: Product }) {
  return (
    <div className='space-y-3 rounded-xl border bg-muted/20 p-4'>
      <div>
        <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
          Estado comercial
        </div>
        <p className='mt-1 text-xs text-muted-foreground'>
          Actualizá el avance sin entrar a edición completa.
        </p>
      </div>
      <QuickStatusSelect
        propertyEngagement={propertyEngagement}
        className='h-10 max-w-none rounded-lg px-3 text-sm'
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1 rounded-xl border bg-background p-3 shadow-xs'>
      <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {label}
      </div>
      <div className='break-words text-sm font-medium'>{value}</div>
    </div>
  );
}

function getDefaultValues(initialData: Product | null): ProductFormValues {
  if (!initialData) {
    return {
      title: '',
      addressLine: '',
      city: '',
      province: '',
      propertyType: 'APARTMENT',
      operationType: 'SALE',
      publishedPrice: undefined,
      currency: 'ARS',
      totalAreaSqm: undefined,
      coveredAreaSqm: undefined,
      rooms: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      garages: undefined,
      ageYears: undefined,
      orientation: '',
      ownerName: '',
      ownerEmail: '',
      image: []
    } as ProductFormValues;
  }

  return {
    title: initialData.property.title,
    addressLine: initialData.property.addressLine,
    city: initialData.property.city,
    province: initialData.property.province,
    propertyType: initialData.property.propertyType,
    operationType: initialData.operationType,
    publishedPrice: centsToAmount(initialData.publishedPriceCents),
    currency: initialData.currency ?? 'ARS',
    totalAreaSqm: initialData.property.totalAreaSqm ?? undefined,
    coveredAreaSqm: initialData.property.coveredAreaSqm ?? undefined,
    rooms: initialData.property.rooms ?? undefined,
    bedrooms: initialData.property.bedrooms ?? undefined,
    bathrooms: initialData.property.bathrooms ?? undefined,
    garages: initialData.property.garages ?? undefined,
    ageYears: initialData.property.ageYears ?? undefined,
    orientation: initialData.property.orientation ?? '',
    ownerName: initialData.property.ownerName ?? '',
    ownerEmail: initialData.property.ownerEmail ?? '',
    image: []
  } as ProductFormValues;
}

function toCreatePayload(value: ProductFormValues): ProductMutationPayload {
  const totalAreaSqm = optionalIntegerValue(value.totalAreaSqm);
  const coveredAreaSqm = optionalIntegerValue(value.coveredAreaSqm);
  const rooms = optionalIntegerValue(value.rooms);
  const bedrooms = optionalIntegerValue(value.bedrooms);
  const bathrooms = optionalIntegerValue(value.bathrooms);
  const garages = optionalIntegerValue(value.garages);
  const ageYears = optionalIntegerValue(value.ageYears);
  const orientation = value.orientation?.trim();

  return {
    title: value.title,
    addressLine: value.addressLine,
    city: value.city,
    province: value.province,
    propertyType: value.propertyType,
    operationType: value.operationType,
    ...(typeof value.publishedPrice === 'number' && {
      publishedPriceCents: amountToCents(value.publishedPrice)
    }),
    ...(value.currency && { currency: value.currency.toUpperCase() }),
    ...(totalAreaSqm !== undefined && { totalAreaSqm }),
    ...(coveredAreaSqm !== undefined && { coveredAreaSqm }),
    ...(rooms !== undefined && { rooms }),
    ...(bedrooms !== undefined && { bedrooms }),
    ...(bathrooms !== undefined && { bathrooms }),
    ...(garages !== undefined && { garages }),
    ...(ageYears !== undefined && { ageYears }),
    ...(orientation && { orientation }),
    ...(value.ownerName && { ownerName: value.ownerName }),
    ...(value.ownerEmail && { ownerEmail: value.ownerEmail })
  };
}

function toUpdatePayload(value: ProductFormValues): ProductMutationPayload {
  return {
    title: value.title,
    addressLine: value.addressLine,
    city: value.city,
    province: value.province,
    propertyType: value.propertyType,
    operationType: value.operationType,
    publishedPriceCents: optionalAmountToCentsOrNull(value.publishedPrice),
    ...(value.currency && { currency: value.currency.toUpperCase() }),
    totalAreaSqm: optionalIntegerOrNull(value.totalAreaSqm),
    coveredAreaSqm: optionalIntegerOrNull(value.coveredAreaSqm),
    rooms: optionalIntegerOrNull(value.rooms),
    bedrooms: optionalIntegerOrNull(value.bedrooms),
    bathrooms: optionalIntegerOrNull(value.bathrooms),
    garages: optionalIntegerOrNull(value.garages),
    ageYears: optionalIntegerOrNull(value.ageYears),
    orientation: optionalStringOrNull(value.orientation),
    ownerName: optionalStringOrNull(value.ownerName),
    ownerEmail: optionalStringOrNull(value.ownerEmail)
  };
}

async function uploadSelectedImages(productId: string, images: File[]) {
  let failures = 0;

  for (const image of images) {
    try {
      await uploadProductImage(productId, image);
    } catch {
      failures += 1;
    }
  }

  return failures;
}

function getCarouselImages(product: Product) {
  if (product.property.images.length > 0) {
    return product.property.images;
  }

  return product.property.primaryImage ? [product.property.primaryImage] : [];
}

function getImageUploadDescription(availableImageSlots: number) {
  const slotLabel = availableImageSlots === 1 ? '1 imagen' : `${availableImageSlots} imágenes`;
  return `Podés seleccionar hasta ${slotLabel}. JPG, PNG o WebP de hasta 5 MB cada una.`;
}

function getPropertySaveSuccessMessage(type: 'create' | 'edit', imageUploadCount: number) {
  if (imageUploadCount === 0) {
    return type === 'edit'
      ? 'Propiedad actualizada correctamente'
      : 'Propiedad creada correctamente';
  }

  const propertyAction = type === 'edit' ? 'actualizada' : 'creada';
  const imageLabel =
    imageUploadCount === 1 ? '1 imagen subida' : `${imageUploadCount} imágenes subidas`;
  return `Propiedad ${propertyAction} y ${imageLabel}.`;
}

function optionalIntegerValue(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalIntegerOrNull(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function centsToAmount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value / 100 : undefined;
}

function formatAmountInput(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)
    : '';
}

function parseAmountInput(value: string) {
  const normalizedValue = value.replace(/\D/g, '');
  return normalizedValue ? Number(normalizedValue) : '';
}

function amountToCents(value: number) {
  return Math.round(value * 100);
}

function optionalAmountToCentsOrNull(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? amountToCents(value) : null;
}

function optionalStringOrNull(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatOptionalNumber(value: number | null) {
  return value === null ? 'Sin dato' : new Intl.NumberFormat('es-AR').format(value);
}

function formatNumberWithSuffix(value: number | null, suffix: string) {
  return value === null ? 'Sin dato' : `${new Intl.NumberFormat('es-AR').format(value)} ${suffix}`;
}

function formatPrice(value: number | null, currency: string | null) {
  if (value === null) {
    return 'Sin precio';
  }

  return new Intl.NumberFormat('es-AR', {
    currency: currency ?? 'ARS',
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(value / 100);
}

function getAssignAllAgentsSuccessMessage(count: number) {
  if (count === 1) {
    return '1 vendedor asignado';
  }

  return `${count} vendedores asignados`;
}

function getOwnerLinkErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'No se pudo vincular el propietario.';
  }

  if (error.message.includes('already linked')) {
    return 'Ese propietario ya está vinculado a esta propiedad.';
  }

  return error.message || 'No se pudo vincular el propietario.';
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
