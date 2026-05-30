'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Badge } from '@/components/ui/badge';
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
import type { Product, ProductMutationPayload, PropertyImage } from '../api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { CreatePropertyMovementDialog } from './create-property-movement-dialog';
import { PropertyAgentsSection } from './property-agents-section';
import { PropertyOwnerSection } from './property-owner-section';
import { PropertyMovementHistory } from './property-movement-history';
import { PropertyDocumentRequests } from './property-document-requests';
import { PropertyDetailHeader, PropertyReadOnlySections } from './property-detail-summary';
import { PropertyStatusSummary } from './property-status-summary';
import { DeletePropertyImageDialog, PropertyImagePreviewDialog } from './property-image-dialogs';
import { ExistingImagesSummary, PropertyImageCarousel } from './property-images';
import { usePropertyMovementsController } from './use-property-movements-controller';
import { isArchivedProduct } from './product-tables/columns';

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

function PropertyEngagementDetails({
  propertyEngagement,
  pageTitle
}: {
  propertyEngagement: Product;
  pageTitle: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isArchived = isArchivedProduct(propertyEngagement);
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
        <div className='grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]'>
          <PropertyImageCarousel
            images={getCarouselImages(propertyEngagement)}
            title={propertyEngagement.property.title}
          />

          <aside className='flex flex-col gap-3 rounded-2xl border bg-card p-3 shadow-xs sm:p-4'>
            <PropertyStatusSummary
              isArchived={isArchived}
              propertyEngagement={propertyEngagement}
            />

            <PropertyOwnerSection
              isArchived={isArchived}
              ownerEmail={propertyEngagement.property.ownerEmail}
              ownerName={propertyEngagement.property.ownerName}
              owners={propertyEngagement.property.owners}
              productId={propertyEngagement.id}
            />

            <PropertyAgentsSection
              agents={propertyEngagement.agents}
              isArchived={isArchived}
              productId={propertyEngagement.id}
              tenantId={propertyEngagement.tenantId}
            />
          </aside>
        </div>

        <PropertyReadOnlySections propertyEngagement={propertyEngagement} />

        <PropertyMovementHistory
          isError={movements.isError}
          isLoading={movements.isLoading}
          movements={movements.items}
        />

        <PropertyDocumentRequests
          isArchived={isArchived}
          owners={propertyEngagement.property.owners}
          productId={propertyEngagement.id}
          tenantId={propertyEngagement.tenantId}
        />
      </CardContent>
      <CreatePropertyMovementDialog
        open={movements.dialogOpen}
        isSubmitting={movements.isCreatingMovement}
        onOpenChange={movements.setDialogOpen}
        onSubmit={movements.handleCreateMovement}
      />
    </Card>
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
