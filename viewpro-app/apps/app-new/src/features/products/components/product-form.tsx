'use client';

import { useAppForm, useFormFields } from '@/components/ui/tanstack-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { productKeys } from '../api/queries';
import {
  createProduct,
  deleteProductImage,
  updateProduct,
  uploadProductImage
} from '../api/service';
import type { Product, ProductMutationPayload, PropertyImage } from '../api/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  operationTypeOptions,
  propertyTypeOptions
} from '@/features/products/constants/product-options';
import { QuickStatusSelect } from './quick-status-select';
import { getOperationTypeLabel, getPropertyTypeLabel } from './product-tables/columns';
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
        return { imageUploadFailures, propertyId: updatedProperty.id, type: 'edit' as const };
      }

      const createdProperty = await createProduct(toCreatePayload(value));
      const imageUploadFailures = await uploadSelectedImages(createdProperty.id, images);
      return { imageUploadFailures, propertyId: createdProperty.id, type: 'create' as const };
    },
    onSuccess: async ({ imageUploadFailures, propertyId, type }) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });

      if (imageUploadFailures > 0) {
        toast.warning(
          imageUploadFailures === 1
            ? 'La propiedad se guardó, pero no se pudo subir una imagen.'
            : `La propiedad se guardó, pero no se pudieron subir ${imageUploadFailures} imágenes.`
        );
      } else {
        toast.success(
          type === 'edit' ? 'Propiedad actualizada correctamente' : 'Propiedad creada correctamente'
        );
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
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent>
        <form.AppForm>
          <form.Form className='space-y-8'>
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

              <FormTextField
                name='publishedPriceCents'
                label='Precio publicado en centavos'
                type='number'
                min={0}
                step={1}
                placeholder='12000000'
              />

              <FormTextField
                name='currency'
                label='Moneda'
                placeholder='ARS'
                validators={{
                  onBlur: z.string().max(3, 'Usá un código de moneda de 3 letras.')
                }}
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

              <div className='space-y-4 md:col-span-2'>
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
                  <FormFileUploadField
                    name='image'
                    label={isEditMode ? 'Agregar imágenes' : 'Imágenes'}
                    description={getImageUploadDescription(availableImageSlots)}
                    maxFiles={availableImageSlots}
                    maxSize={PROPERTY_IMAGE_MAX_BYTES}
                    accept={PROPERTY_IMAGE_ACCEPT}
                  />
                ) : (
                  <div className='rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground'>
                    Esta propiedad ya tiene el máximo de 5 imágenes.
                  </div>
                )}
              </div>
            </div>

            <div className='flex justify-end gap-2'>
              <Button type='button' variant='outline' onClick={() => router.back()}>
                Volver
              </Button>
              <form.SubmitButton disabled={mutation.isPending}>
                {isEditMode ? 'Guardar cambios' : 'Crear propiedad'}
              </form.SubmitButton>
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
          image={imagePreview}
          open={Boolean(imagePreview)}
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
  image,
  open,
  onOpenChange
}: {
  image: PropertyImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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

  return (
    <Card className='mx-auto w-full'>
      <CardHeader>
        <CardTitle className='text-left text-2xl font-bold'>{pageTitle}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-6'>
        <PropertyImageCarousel
          images={getCarouselImages(propertyEngagement)}
          title={propertyEngagement.property.title}
        />

        <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
          <ReadOnlyField label='Título' value={propertyEngagement.property.title} />
          <ReadOnlyField
            label='Tipo'
            value={getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          />
          <ReadOnlyField label='Dirección' value={propertyEngagement.property.addressLine} />
          <ReadOnlyField label='Ciudad' value={propertyEngagement.property.city} />
          <ReadOnlyField label='Provincia' value={propertyEngagement.property.province} />
          <ReadOnlyField
            label='Operación'
            value={getOperationTypeLabel(propertyEngagement.operationType)}
          />
          <ReadOnlyStatusField propertyEngagement={propertyEngagement} />
          <ReadOnlyField
            label='Precio'
            value={formatPrice(propertyEngagement.publishedPriceCents, propertyEngagement.currency)}
          />
          <ReadOnlyField
            label='Propietario'
            value={propertyEngagement.property.ownerName ?? 'Sin nombre'}
          />
          <ReadOnlyField
            label='Email propietario'
            value={propertyEngagement.property.ownerEmail ?? 'Sin email'}
          />
        </div>

        <div className='space-y-3'>
          <div>
            <h3 className='text-sm font-semibold'>Características</h3>
            <p className='text-xs text-muted-foreground'>
              Datos físicos registrados para esta propiedad.
            </p>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
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
        </div>

        <div className='flex flex-col justify-end gap-2 sm:flex-row'>
          <Button type='button' variant='outline' onClick={() => router.push('/dashboard/product')}>
            Volver al listado
          </Button>
          <Button
            type='button'
            onClick={() => router.push(`/dashboard/product/${propertyEngagement.id}/edit`)}
          >
            Editar propiedad
          </Button>
        </div>
      </CardContent>
    </Card>
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
      <div className='flex h-56 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground'>
        Sin imagen principal
      </div>
    );
  }

  const hasMultipleImages = images.length > 1;

  function showPreviousImage() {
    setActiveIndex((current) => (current === 0 ? images.length - 1 : current - 1));
  }

  function showNextImage() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  return (
    <div className='relative h-56 w-full overflow-hidden rounded-lg border bg-muted'>
      <PropertyImagePreview
        key={activeImage.id}
        src={activeImage.url}
        alt={`Imagen ${activeIndex + 1} de ${images.length} de ${title}`}
        className='absolute inset-0 h-full w-full object-cover'
        fallbackClassName='p-4'
      />
      {hasMultipleImages ? (
        <>
          <Button
            type='button'
            variant='secondary'
            size='icon'
            className='absolute left-3 top-1/2 size-8 -translate-y-1/2 rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background'
            onClick={showPreviousImage}
          >
            <Icons.chevronLeft className='h-4 w-4' />
            <span className='sr-only'>Imagen anterior</span>
          </Button>
          <Button
            type='button'
            variant='secondary'
            size='icon'
            className='absolute right-3 top-1/2 size-8 -translate-y-1/2 rounded-full bg-background/80 shadow-sm backdrop-blur hover:bg-background'
            onClick={showNextImage}
          >
            <Icons.chevronRight className='h-4 w-4' />
            <span className='sr-only'>Imagen siguiente</span>
          </Button>
          <div className='absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-background/75 px-2 py-1 backdrop-blur'>
            {images.map((image, index) => (
              <button
                key={image.id}
                type='button'
                aria-label={`Ver imagen ${index + 1}`}
                aria-current={index === activeIndex ? 'true' : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  index === activeIndex ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/50'
                }`}
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        </>
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
      <div className='rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground'>
        Esta propiedad todavía no tiene imágenes cargadas.
      </div>
    );
  }

  return (
    <div className='rounded-xl border bg-muted/20 p-4'>
      <div className='mb-3 flex items-center justify-between gap-2'>
        <div>
          <h3 className='text-sm font-semibold'>Imágenes actuales</h3>
          <p className='text-xs text-muted-foreground'>
            {images.length} de {PROPERTY_IMAGE_MAX_FILES} imágenes cargadas. Podés eliminar imágenes
            desde el botón de cada miniatura; el reordenamiento sigue pendiente.
          </p>
        </div>
      </div>
      <div className='flex gap-2 overflow-x-auto pb-1'>
        {images.map((image) => {
          const isDeleting = pendingDeleteImageId === image.id;

          return (
            <div
              key={image.id}
              className='group relative h-24 w-36 shrink-0 overflow-hidden rounded-lg border bg-muted shadow-xs transition hover:border-foreground/20 hover:shadow-sm'
            >
              <button
                type='button'
                className='absolute inset-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                onClick={() => onPreviewImage(image)}
              >
                <PropertyImagePreview
                  src={image.url}
                  alt={image.originalFilename}
                  className='h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]'
                  fallbackClassName='p-3 text-[11px]'
                />
                <span className='sr-only'>Ver imagen {image.originalFilename}</span>
              </button>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-0.5 top-0.5 z-10 size-5 rounded-full border border-destructive/70 bg-background/75 text-destructive shadow-xs backdrop-blur hover:border-destructive hover:bg-destructive/90 hover:text-white focus-visible:ring-destructive/30'
                disabled={isDeleting}
                isLoading={isDeleting}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteImage(image);
                }}
              >
                <Icons.close className='size-3' />
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
    <div className='space-y-2 rounded-md border p-3'>
      <div className='text-xs font-medium uppercase text-muted-foreground'>Estado</div>
      <QuickStatusSelect propertyEngagement={propertyEngagement} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className='space-y-1 rounded-md border p-3'>
      <div className='text-xs font-medium uppercase text-muted-foreground'>{label}</div>
      <div className='text-sm'>{value}</div>
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
      publishedPriceCents: undefined,
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
    publishedPriceCents: initialData.publishedPriceCents ?? undefined,
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
    ...(typeof value.publishedPriceCents === 'number' && {
      publishedPriceCents: value.publishedPriceCents
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
    publishedPriceCents: optionalNumberOrNull(value.publishedPriceCents),
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
  return `Podés agregar hasta ${slotLabel}. JPG, PNG o WebP de hasta 5 MB cada una.`;
}

function optionalIntegerValue(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalIntegerOrNull(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function optionalNumberOrNull(value: number | '' | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
    style: 'currency'
  }).format(value / 100);
}
