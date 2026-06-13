import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { Product } from '../api/types';
import { PropertyStatusSummary } from './property-status-summary';

describe('PropertyStatusSummary', () => {
  it('renders the published price, currency, and status section', () => {
    renderPropertyStatusSummary();

    expect(screen.getByText('Precio publicado')).toBeInTheDocument();
    expect(screen.getByText((text) => text.includes('120.000'))).toBeInTheDocument();
    expect(screen.getByText('Moneda: ARS')).toHaveClass('text-foreground/70');
    expect(screen.getByText('Estado comercial')).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Cambiar estado de Casa demo' })
    ).toBeInTheDocument();
  });

  it('renders Sin precio and default ARS currency when price and currency are missing', () => {
    renderPropertyStatusSummary({
      propertyEngagement: createProduct({ currency: null, publishedPriceCents: null })
    });

    expect(screen.getByText('Sin precio')).toBeInTheDocument();
    expect(screen.getByText('Moneda: ARS')).toBeInTheDocument();
  });

  it('uses semantic success tone for active publication status', () => {
    renderPropertyStatusSummary({
      propertyEngagement: createProduct({ status: 'ACTIVE_PUBLICATION' })
    });

    expect(screen.getByRole('combobox', { name: 'Cambiar estado de Casa demo' })).toHaveClass(
      'border-emerald-200',
      'text-emerald-800'
    );
  });

  it('renders status as read-only when status updates are not permitted', () => {
    renderPropertyStatusSummary({
      canUpdateStatus: false,
      propertyEngagement: createProduct({ status: 'ACTIVE_PUBLICATION' })
    });

    expect(screen.queryByRole('combobox', { name: 'Cambiar estado de Casa demo' })).not.toBeInTheDocument();
    expect(screen.getByText('Publicación activa')).toHaveClass('border-emerald-200', 'text-emerald-800');
    expect(screen.getByText('Estado oficial de la gestión.')).toBeInTheDocument();
  });

  it('renders archived details when the property is archived', () => {
    renderPropertyStatusSummary({
      isArchived: true,
      propertyEngagement: createProduct({
        archiveReason: 'Venta pausada',
        archivedAt: '2026-05-29T12:00:00.000Z'
      })
    });

    expect(screen.getByText('Archivada')).toBeInTheDocument();
    expect(screen.getByText('Fecha:')).toBeInTheDocument();
    expect(screen.getByText('Motivo:')).toBeInTheDocument();
    expect(screen.getByText('Venta pausada')).toBeInTheDocument();
  });

  it('hides archived details when the property is active', () => {
    renderPropertyStatusSummary();

    expect(screen.queryByText('Motivo:')).not.toBeInTheDocument();
  });
});

function renderPropertyStatusSummary({
  canUpdateStatus = true,
  isArchived = false,
  propertyEngagement = createProduct()
}: {
  canUpdateStatus?: boolean;
  isArchived?: boolean;
  propertyEngagement?: Product;
} = {}) {
  return render(
    <PropertyStatusSummary
      canUpdateStatus={canUpdateStatus}
      isArchived={isArchived}
      propertyEngagement={propertyEngagement}
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

type ProductOverrides = Omit<Partial<Product>, 'property'> & {
  property?: Partial<Product['property']>;
};

function createProduct(overrides: ProductOverrides = {}): Product {
  const { property: propertyOverrides, ...productOverrides } = overrides;

  return {
    agents: [],
    archivedAt: null,
    archivedByUserId: null,
    archiveReason: null,
    createdAt: '2026-05-29T10:00:00.000Z',
    currency: 'ARS',
    id: 'engagement-1',
    operationType: 'SALE',
    property: {
      addressLine: 'Av. Siempre Viva 742',
      ageYears: 15,
      bathrooms: 2,
      bedrooms: 3,
      city: 'Springfield',
      coveredAreaSqm: 95,
      garages: 1,
      id: 'property-1',
      images: [],
      orientation: 'Norte',
      ownerEmail: 'owner@example.com',
      ownerName: 'Ana Owner',
      owners: [],
      primaryImage: null,
      propertyType: 'HOUSE',
      province: 'Buenos Aires',
      rooms: 4,
      title: 'Casa demo',
      totalAreaSqm: 120,
      ...propertyOverrides
    },
    publishedPriceCents: 12000000,
    status: 'CAPTURE',
    tenantId: 'tenant-1',
    updatedAt: '2026-05-29T10:00:00.000Z',
    ...productOverrides
  };
}
