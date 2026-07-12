import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { PropertyImage } from '../api/types';
import {
  ExistingImagesSummary,
  PropertyImageCarousel,
  PropertyImagePreview
} from './property-images';

const firstImage = propertyImage({
  id: 'image-1',
  originalFilename: 'fachada.jpg',
  url: 'https://assets.example/fachada.jpg',
  isPrimary: true
});
const secondImage = propertyImage({
  id: 'image-2',
  originalFilename: 'living.jpg',
  url: 'https://assets.example/living.jpg',
  isPrimary: false
});

describe('PropertyImagePreview', () => {
  it('shows a fallback when the image cannot load', () => {
    render(<PropertyImagePreview src='broken.jpg' alt='Fachada' className='h-10 w-10' />);

    fireEvent.error(screen.getByRole('img', { name: 'Fachada' }));

    expect(screen.getByRole('img', { name: 'Fachada no disponible' })).toBeInTheDocument();
    expect(screen.getByText('Imagen no disponible')).toBeInTheDocument();
  });
});

describe('PropertyImageCarousel', () => {
  it('renders the empty state when there are no images', () => {
    render(<PropertyImageCarousel images={[]} title='Casa demo' />);

    expect(screen.getByText('Sin imágenes cargadas')).toBeInTheDocument();
  });

  it('renders the active image and changes image from thumbnails', async () => {
    const user = userEvent.setup();
    render(<PropertyImageCarousel images={[firstImage, secondImage]} title='Casa demo' />);

    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagen 1 de 2 de Casa demo' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ver imagen 2' }));

    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Imagen 2 de 2 de Casa demo' })).toBeInTheDocument();
  });

  it('keeps the carousel and thumbnail strip shrinkable inside responsive grids', () => {
    const { container } = render(
      <PropertyImageCarousel images={[firstImage, secondImage]} title='Casa demo' />
    );

    expect(container.firstChild).toHaveClass('min-w-0', 'w-full', 'max-w-full');
    expect(screen.getByRole('button', { name: 'Ver imagen 1' }).parentElement).toHaveClass(
      'max-w-full',
      'overflow-x-auto'
    );
  });
});

describe('ExistingImagesSummary', () => {
  it('renders the empty summary state', () => {
    render(<ExistingImagesSummary images={[]} onDeleteImage={vi.fn()} onPreviewImage={vi.fn()} />);

    expect(screen.getByText('Todavía no hay imágenes')).toBeInTheDocument();
  });

  it('calls preview and delete handlers for existing images', async () => {
    const user = userEvent.setup();
    const onPreviewImage = vi.fn();
    const onDeleteImage = vi.fn();
    render(
      <ExistingImagesSummary
        images={[firstImage]}
        onDeleteImage={onDeleteImage}
        onPreviewImage={onPreviewImage}
      />
    );

    await user.click(screen.getByRole('button', { name: /Ver imagen fachada\.jpg/ }));
    expect(onPreviewImage).toHaveBeenCalledWith(firstImage);

    await user.click(screen.getByRole('button', { name: /Eliminar imagen fachada\.jpg/ }));
    expect(onDeleteImage).toHaveBeenCalledWith(firstImage);
  });

  it('disables the delete action for the pending image', () => {
    render(
      <ExistingImagesSummary
        images={[firstImage]}
        pendingDeleteImageId={firstImage.id}
        onDeleteImage={vi.fn()}
        onPreviewImage={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Eliminar imagen fachada\.jpg/ })).toBeDisabled();
  });
});

function propertyImage(overrides: Partial<PropertyImage> = {}): PropertyImage {
  return {
    id: 'image-id',
    storageKey: 'property-images/image.jpg',
    url: 'https://assets.example/image.jpg',
    originalFilename: 'image.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1234,
    isPrimary: false,
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...overrides
  };
}
