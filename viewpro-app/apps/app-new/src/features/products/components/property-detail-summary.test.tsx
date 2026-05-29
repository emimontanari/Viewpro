import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '../api/types';
import { PropertyDetailHeader, PropertyReadOnlySections } from './property-detail-summary';

const propertyEngagement = createProduct();

describe('PropertyDetailHeader', () => {
  it('renders the title, badges, address, facts, and actions', () => {
    renderPropertyDetailHeader();

    expect(screen.getByText('Ficha de captación')).toBeInTheDocument();
    expect(screen.getByText('Casa demo')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempre Viva 742, Springfield, Buenos Aires')).toBeInTheDocument();
    expect(
      screen.getByText('4 amb. · 3 dorm. · 2 baños · 1 cochera · 95 m² cub. · 120 m² tot.')
    ).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Casa')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver al listado' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar actualización/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar propiedad/i })).toBeInTheDocument();
  });

  it('calls header action callbacks', async () => {
    const user = userEvent.setup();
    const onBackToList = vi.fn();
    const onAddMovement = vi.fn();
    const onEdit = vi.fn();
    renderPropertyDetailHeader({ onBackToList, onAddMovement, onEdit });

    await user.click(screen.getByRole('button', { name: 'Volver al listado' }));
    await user.click(screen.getByRole('button', { name: /agregar actualización/i }));
    await user.click(screen.getByRole('button', { name: /editar propiedad/i }));

    expect(onBackToList).toHaveBeenCalledTimes(1);
    expect(onAddMovement).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('shows restore action and hides movement action when archived', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    renderPropertyDetailHeader({
      isArchived: true,
      onRestore,
      propertyEngagement: createProduct({ archivedAt: '2026-05-29T12:00:00.000Z' })
    });

    expect(screen.getByText('Archivada')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /agregar actualización/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar propiedad/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /restaurar propiedad/i }));

    expect(onRestore).toHaveBeenCalledTimes(1);
  });
});

describe('PropertyReadOnlySections', () => {
  it('renders main property information and characteristic values', () => {
    render(<PropertyReadOnlySections propertyEngagement={propertyEngagement} />);

    expect(screen.getByText('Información principal')).toBeInTheDocument();
    expect(screen.getByText('Características')).toBeInTheDocument();
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.getByText('Springfield, Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('120 m²')).toBeInTheDocument();
    expect(screen.getByText('95 m²')).toBeInTheDocument();
    expect(screen.getByText('15 años')).toBeInTheDocument();
  });

  it('renders missing numeric characteristics as Sin dato', () => {
    render(
      <PropertyReadOnlySections
        propertyEngagement={createProduct({
          property: {
            ageYears: null,
            bathrooms: null,
            bedrooms: null,
            coveredAreaSqm: null,
            garages: null,
            orientation: null,
            rooms: null,
            totalAreaSqm: null
          }
        })}
      />
    );

    expect(screen.getAllByText('Sin dato')).toHaveLength(8);
  });
});

function renderPropertyDetailHeader(
  props: Partial<ComponentProps<typeof PropertyDetailHeader>> = {}
) {
  return render(
    <PropertyDetailHeader
      isAddingMovement={false}
      isArchived={false}
      isRestoring={false}
      pageTitle='Ficha de captación'
      propertyEngagement={propertyEngagement}
      onAddMovement={vi.fn()}
      onBackToList={vi.fn()}
      onEdit={vi.fn()}
      onRestore={vi.fn()}
      {...props}
    />
  );
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
