'use client';

import { Badge } from '@/components/ui/badge';
import { useFormFields } from '@/components/ui/tanstack-form';
import {
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_MAX_FILES,
  type ProductFormValues
} from '@/features/products/schemas/product';
import type { PropertyImage } from '../api/types';
import { ExistingImagesSummary } from './property-images';
import { getImageUploadDescription } from './product-form-mappers';

const PROPERTY_IMAGE_ACCEPT = {
  'image/jpeg': [],
  'image/png': [],
  'image/webp': []
};

type PropertyImageEditorSectionProps = {
  availableImageSlots: number;
  existingImageCount: number;
  images: PropertyImage[];
  isEditMode: boolean;
  onDeleteImage: (image: PropertyImage) => void;
  onPreviewImage: (image: PropertyImage) => void;
  pendingDeleteImageId?: string;
};

export function PropertyImageEditorSection({
  availableImageSlots,
  existingImageCount,
  images,
  isEditMode,
  onDeleteImage,
  onPreviewImage,
  pendingDeleteImageId
}: PropertyImageEditorSectionProps) {
  const { FormFileUploadField } = useFormFields<ProductFormValues>();

  return (
    <section className='space-y-4 rounded-2xl border bg-muted/10 p-4 md:col-span-2'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='space-y-1'>
          <h3 className='text-sm font-semibold'>Galería de imágenes</h3>
          <p className='text-xs text-muted-foreground'>
            Las fotos se suben al guardar la propiedad. Si una imagen viene marcada como principal,
            la señalamos en la galería.
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

      {isEditMode ? (
        <ExistingImagesSummary
          images={images}
          onDeleteImage={onDeleteImage}
          onPreviewImage={onPreviewImage}
          pendingDeleteImageId={pendingDeleteImageId}
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
          La galería ya tiene el máximo de {PROPERTY_IMAGE_MAX_FILES} imágenes. Eliminá una foto
          existente si necesitás subir otra.
        </div>
      )}
    </section>
  );
}
