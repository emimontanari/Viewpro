'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { productKeys } from '../api/queries';
import {
  createProduct,
  deleteProductImage,
  restoreProduct,
  updateProduct,
  uploadProductImage
} from '../api/service';
import type { Product, PropertyImage } from '../api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  productSchema,
  PROPERTY_IMAGE_MAX_FILES,
  type ProductFormValues
} from '@/features/products/schemas/product';
import { currencyOptions } from '@/features/products/constants/product-options';
import { CreatePropertyMovementDialog } from './create-property-movement-dialog';
import { PropertyAgentsSection } from './property-agents-section';
import { PropertyOwnerSection } from './property-owner-section';
import { PropertyMovementHistory } from './property-movement-history';
import { PropertyDocumentRequests } from './property-document-requests';
import { PropertyDetailHeader, PropertyReadOnlySections } from './property-detail-summary';
import { PropertyStatusSummary } from './property-status-summary';
import { DeletePropertyImageDialog, PropertyImagePreviewDialog } from './property-image-dialogs';
import { PropertyImageCarousel } from './property-images';
import {
  PropertyBasicFields,
  PropertyCharacteristicsFields,
  PropertyOwnerReferenceFields
} from './property-editor-field-sections';
import { PropertyImageEditorSection } from './property-image-editor-section';
import { usePropertyMovementsController } from './use-property-movements-controller';
import {
  formatAmountInput,
  getDefaultValues,
  getPropertySaveSuccessMessage,
  parseAmountInput,
  toCreatePayload,
  toUpdatePayload
} from './product-form-mappers';
import { isArchivedProduct } from './product-tables/columns';
import {
  canManagePropertyEngagements,
  canReviewTenantDocuments,
  hasTenantPermission,
  TENANT_PERMISSIONS
} from '@/lib/session';
import { useActiveTenant } from '@/lib/session-context';

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
  const { activeMembership, isTenantLoading } = useActiveTenant();
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

  const { FormSelectField } = useFormFields<ProductFormValues>();

  if (isTenantLoading) {
    return <PropertyPermissionNotice title='Validando permisos' />;
  }

  if (!canManagePropertyEngagements(activeMembership)) {
    return <PropertyPermissionNotice title='No tenés permiso para administrar propiedades' />;
  }

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
              <PropertyBasicFields />

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

              <PropertyCharacteristicsFields />

              <PropertyOwnerReferenceFields />

              <PropertyImageEditorSection
                availableImageSlots={availableImageSlots}
                existingImageCount={existingImageCount}
                images={initialData?.property.images ?? []}
                isEditMode={isEditMode}
                pendingDeleteImageId={
                  deleteImageMutation.isPending ? deleteImageMutation.variables?.id : undefined
                }
                onDeleteImage={handleDeleteImage}
                onPreviewImage={setImagePreview}
              />
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

function PropertyPermissionNotice({ title }: { title: string }) {
  return (
    <Card className='mx-auto w-full overflow-hidden'>
      <CardHeader className='border-b bg-muted/20'>
        <CardTitle className='text-left text-2xl font-bold'>{title}</CardTitle>
        <CardDescription>
          Podés volver al listado y consultar las propiedades que tengas asignadas.
        </CardDescription>
      </CardHeader>
      <CardContent className='p-4 sm:p-6'>
        <Button asChild variant='outline'>
          <Link href='/dashboard/product'>Volver al listado</Link>
        </Button>
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

function PropertyEngagementDetails({
  propertyEngagement,
  pageTitle
}: {
  propertyEngagement: Product;
  pageTitle: string;
}) {
  const { activeMembership } = useActiveTenant();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isArchived = isArchivedProduct(propertyEngagement);
  const canManageProperties = canManagePropertyEngagements(activeMembership);
  const canCreateMovements = hasTenantPermission(activeMembership, TENANT_PERMISSIONS.MOVEMENTS_CREATE);
  const canRequestDocuments = hasTenantPermission(activeMembership, TENANT_PERMISSIONS.DOCUMENTS_REQUEST);
  const canReviewDocuments = canReviewTenantDocuments(activeMembership);
  const movements = usePropertyMovementsController({
    isArchived,
    productId: propertyEngagement.id,
    tenantId: propertyEngagement.tenantId
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
  function handleRestoreProperty() {
    if (restoreMutation.isPending) {
      return;
    }

    restoreMutation.mutate();
  }

  return (
    <Card className='mx-auto w-full overflow-hidden'>
      <CardHeader className='border-b bg-muted/20'>
        <PropertyDetailHeader
          canAddMovement={canCreateMovements}
          canEdit={canManageProperties}
          canRestore={canManageProperties}
          isAddingMovement={movements.isCreatingMovement}
          isArchived={isArchived}
          isRestoring={restoreMutation.isPending}
          pageTitle={pageTitle}
          propertyEngagement={propertyEngagement}
          onAddMovement={() => movements.setDialogOpen(true)}
          onBackToList={() => router.push('/dashboard/product')}
          onEdit={() => router.push(`/dashboard/product/${propertyEngagement.id}/edit`)}
          onRestore={handleRestoreProperty}
        />
      </CardHeader>

      <CardContent className='space-y-6 p-4 sm:p-6'>
        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)] xl:items-start'>
          <div className='min-w-0 space-y-4'>
            <PropertyImageCarousel
              images={getCarouselImages(propertyEngagement)}
              title={propertyEngagement.property.title}
            />

            <PropertyReadOnlySections
              className='hidden border-t border-border/40 pt-4 xl:block'
              density='compact'
              propertyEngagement={propertyEngagement}
            />
          </div>

          <aside className='flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-xs sm:p-4'>
            <PropertyStatusSummary
              canUpdateStatus={canManageProperties}
              isArchived={isArchived}
              propertyEngagement={propertyEngagement}
            />

            <PropertyOwnerSection
              canManageOwners={canManageProperties}
              isArchived={isArchived}
              ownerEmail={propertyEngagement.property.ownerEmail}
              ownerName={propertyEngagement.property.ownerName}
              owners={propertyEngagement.property.owners}
              productId={propertyEngagement.id}
            />

            <PropertyAgentsSection
              agents={propertyEngagement.agents}
              canManageAgents={canManageProperties}
              isArchived={isArchived}
              productId={propertyEngagement.id}
              tenantId={propertyEngagement.tenantId}
            />
          </aside>
        </div>

        <PropertyReadOnlySections className='xl:hidden' propertyEngagement={propertyEngagement} />

        <PropertyMovementHistory
          isError={movements.isError}
          isLoading={movements.isLoading}
          movements={movements.items}
        />

        <PropertyDocumentRequests
          canRequestDocuments={canRequestDocuments}
          canReviewDocuments={canReviewDocuments}
          isArchived={isArchived}
          owners={propertyEngagement.property.owners}
          productId={propertyEngagement.id}
          tenantId={propertyEngagement.tenantId}
        />
      </CardContent>
      <CreatePropertyMovementDialog
        canUpdateStatus={canManageProperties}
        open={movements.dialogOpen}
        isSubmitting={movements.isCreatingMovement}
        onOpenChange={movements.setDialogOpen}
        onSubmit={movements.handleCreateMovement}
      />
    </Card>
  );
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
