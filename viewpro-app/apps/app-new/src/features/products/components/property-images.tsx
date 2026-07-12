import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PROPERTY_IMAGE_MAX_FILES } from '@/features/products/schemas/product';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { PropertyImage } from '../api/types';

export function PropertyImagePreview({
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

export function PropertyImageCarousel({
  images,
  title
}: {
  images: PropertyImage[];
  title: string;
}) {
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
    <div className='min-w-0 w-full max-w-full space-y-3'>
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
            'flex max-w-full justify-start gap-3 overflow-x-auto pb-1',
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

export function ExistingImagesSummary({
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
