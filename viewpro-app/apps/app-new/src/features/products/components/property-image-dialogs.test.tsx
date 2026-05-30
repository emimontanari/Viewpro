import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { productKeys } from '../api/queries';
import type { PropertyImage } from '../api/types';
import { DeletePropertyImageDialog, PropertyImagePreviewDialog } from './property-image-dialogs';

const mocks = vi.hoisted(() => ({
  setProductImageAsPrimary: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}));

vi.mock('../api/service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/service')>();

  return {
    ...actual,
    setProductImageAsPrimary: mocks.setProductImageAsPrimary
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess
  }
}));

const image = createImage({ id: 'image-1', originalFilename: 'fachada.jpg', isPrimary: false });

describe('DeletePropertyImageDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the filename and confirms deletion', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <DeletePropertyImageDialog
        image={image}
        loading={false}
        open={true}
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText(/fachada\.jpg/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /eliminar imagen/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables cancel while loading', () => {
    render(
      <DeletePropertyImageDialog
        image={image}
        loading={true}
        open={true}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /cancelar/i })).toBeDisabled();
  });
});

describe('PropertyImagePreviewDialog', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the selected image and primary action', () => {
    renderPropertyImagePreviewDialog({ image });

    expect(screen.getByRole('dialog', { name: /vista previa de imagen/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'fachada.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /poner como principal/i })).toBeInTheDocument();
  });

  it('disables primary action when the image is already primary', () => {
    renderPropertyImagePreviewDialog({ image: createImage({ isPrimary: true }) });

    expect(screen.getByRole('button', { name: /imagen principal/i })).toBeDisabled();
  });

  it('sets a non-primary image as primary', async () => {
    const user = userEvent.setup();
    const updatedImage = createImage({ id: image.id, isPrimary: true });
    const onPrimaryChange = vi.fn();
    const invalidateQueriesSpy = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    mocks.setProductImageAsPrimary.mockResolvedValue(updatedImage);
    renderPropertyImagePreviewDialog({ image, onPrimaryChange });

    await user.click(screen.getByRole('button', { name: /poner como principal/i }));

    await waitFor(() => {
      expect(mocks.setProductImageAsPrimary).toHaveBeenCalledWith('product-1', image.id);
    });
    expect(onPrimaryChange).toHaveBeenCalledWith(updatedImage);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: productKeys.all });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Imagen principal actualizada');
  });

  it('shows an error toast when primary update fails', async () => {
    const user = userEvent.setup();
    mocks.setProductImageAsPrimary.mockRejectedValue(new Error('No autorizado'));
    renderPropertyImagePreviewDialog({ image });

    await user.click(screen.getByRole('button', { name: /poner como principal/i }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith('No autorizado');
    });
  });
});

function renderPropertyImagePreviewDialog({
  engagementId = 'product-1',
  image: selectedImage = image,
  onPrimaryChange = vi.fn()
}: {
  engagementId?: string;
  image?: PropertyImage | null;
  onPrimaryChange?: (image: PropertyImage) => void;
} = {}) {
  return render(
    <PropertyImagePreviewDialog
      engagementId={engagementId}
      image={selectedImage}
      open={true}
      onPrimaryChange={onPrimaryChange}
      onOpenChange={vi.fn()}
    />,
    { wrapper: createQueryClientWrapper() }
  );
}

function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false }
    }
  });

  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
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
