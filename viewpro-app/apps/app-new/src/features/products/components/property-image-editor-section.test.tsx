import { useAppForm } from '@/components/ui/tanstack-form';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyImage } from '../api/types';
import { productSchema, type ProductFormValues } from '../schemas/product';
import { PropertyImageEditorSection } from './property-image-editor-section';

const image = createImage({ id: 'image-1', originalFilename: 'fachada.jpg', isPrimary: true });

describe('PropertyImageEditorSection', () => {
  it('renders the create-mode upload field without existing image summary', () => {
    renderPropertyImageEditorSection({ isEditMode: false });

    expect(screen.getByText('Galería de imágenes')).toBeInTheDocument();
    expect(screen.getByText('0 / 5 cargadas')).toBeInTheDocument();
    expect(screen.getByText('Imágenes iniciales')).toBeInTheDocument();
    expect(screen.queryByText('Imágenes actuales')).not.toBeInTheDocument();
  });

  it('renders existing images and edit-mode upload label', () => {
    renderPropertyImageEditorSection({
      existingImageCount: 1,
      images: [image],
      isEditMode: true
    });

    expect(screen.getByText('1 / 5 cargadas')).toBeInTheDocument();
    expect(screen.getByText('Imágenes actuales')).toBeInTheDocument();
    expect(screen.getByText('Sumar nuevas imágenes')).toBeInTheDocument();
  });

  it('renders the max-images message when no slots are available', () => {
    renderPropertyImageEditorSection({
      availableImageSlots: 0,
      existingImageCount: 5,
      images: [image],
      isEditMode: true
    });

    expect(
      screen.getByText(
        'La galería ya tiene el máximo de 5 imágenes. Eliminá una foto existente si necesitás subir otra.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Sumar nuevas imágenes')).not.toBeInTheDocument();
  });

  it('forwards preview and delete callbacks through the existing image summary', async () => {
    const user = userEvent.setup();
    const onDeleteImage = vi.fn();
    const onPreviewImage = vi.fn();
    renderPropertyImageEditorSection({
      existingImageCount: 1,
      images: [image],
      isEditMode: true,
      onDeleteImage,
      onPreviewImage
    });

    await user.click(screen.getByRole('button', { name: /Ver imagen fachada\.jpg/ }));
    expect(onPreviewImage).toHaveBeenCalledWith(image);

    await user.click(screen.getByRole('button', { name: /Eliminar imagen fachada\.jpg/ }));
    expect(onDeleteImage).toHaveBeenCalledWith(image);
  });

  it('passes the pending delete id to the existing image summary', () => {
    renderPropertyImageEditorSection({
      existingImageCount: 1,
      images: [image],
      isEditMode: true,
      pendingDeleteImageId: image.id
    });

    expect(screen.getByRole('button', { name: /Eliminar imagen fachada\.jpg/ })).toBeDisabled();
  });
});

function renderPropertyImageEditorSection({
  availableImageSlots = 5,
  existingImageCount = 0,
  images = [],
  isEditMode = false,
  onDeleteImage = vi.fn(),
  onPreviewImage = vi.fn(),
  pendingDeleteImageId
}: Partial<ComponentProps<typeof PropertyImageEditorSection>> = {}) {
  return render(
    <ImageEditorSectionHarness
      availableImageSlots={availableImageSlots}
      existingImageCount={existingImageCount}
      images={images}
      isEditMode={isEditMode}
      onDeleteImage={onDeleteImage}
      onPreviewImage={onPreviewImage}
      pendingDeleteImageId={pendingDeleteImageId}
    />
  );
}

function ImageEditorSectionHarness(props: ComponentProps<typeof PropertyImageEditorSection>) {
  const form = useAppForm({
    defaultValues: createFormValues(),
    validators: { onSubmit: productSchema },
    onSubmit: vi.fn()
  });

  return (
    <form.AppForm>
      <PropertyImageEditorSection {...props} />
    </form.AppForm>
  );
}

function createFormValues(): ProductFormValues {
  return {
    addressLine: 'Av. Siempre Viva 742',
    city: 'Springfield',
    currency: 'ARS',
    image: [],
    operationType: 'SALE',
    ownerEmail: '',
    ownerName: '',
    propertyType: 'HOUSE',
    province: 'Buenos Aires',
    title: 'Casa demo'
  } as ProductFormValues;
}

function createImage(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    createdAt: '2026-05-30T10:00:00.000Z',
    id: 'image-id',
    isPrimary: false,
    mimeType: 'image/jpeg',
    originalFilename: 'image.jpg',
    sizeBytes: 1234,
    storageKey: 'property-images/image.jpg',
    updatedAt: '2026-05-30T10:00:00.000Z',
    url: 'https://assets.example/image.jpg',
    ...overrides
  };
}
