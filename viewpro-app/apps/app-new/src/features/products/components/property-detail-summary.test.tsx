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

  it('hides edit and movement actions when they are not permitted', () => {
    renderPropertyDetailHeader({ canAddMovement: false, canEdit: false });

    expect(screen.getByRole('button', { name: 'Volver al listado' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /agregar actualización/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar propiedad/i })).not.toBeInTheDocument();
  });

  it('hides restore action for archived properties when restore is not permitted', () => {
    renderPropertyDetailHeader({
      canRestore: false,
      isArchived: true,
      propertyEngagement: createProduct({ archivedAt: '2026-05-29T12:00:00.000Z' })
    });

    expect(screen.queryByRole('button', { name: /restaurar propiedad/i })).not.toBeInTheDocument();
    expect(screen.getByText('La propiedad está archivada. Pedile a un encargado que la restaure.')).toBeInTheDocument();
  });
});

describe('PropertyReadOnlySections', () => {
  it('renders main property information and characteristic values', () => {
    const { container } = render(
      <PropertyReadOnlySections propertyEngagement={propertyEngagement} />
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Información principal' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Características' })).toBeInTheDocument();
    expect(screen.getByTestId('property-main-info-grid')).toHaveClass('grid-cols-2');
    expect(screen.getByTestId('property-main-info-grid')).not.toHaveClass('grid-cols-1');
    expect(screen.getByTestId('property-characteristics-grid')).toHaveClass(
      'grid-cols-2',
      'sm:grid-cols-3',
      'lg:grid-cols-4'
    );
    expect(container.querySelector('[data-slot="property-read-only-field"]')).toHaveClass(
      'p-2.5',
      'sm:p-3'
    );
    expect(screen.getByText('Av. Siempre Viva 742')).toBeInTheDocument();
    expect(screen.getByText('Springfield, Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText('120 m²')).toBeInTheDocument();
    expect(screen.getByText('95 m²')).toBeInTheDocument();
    expect(screen.getByText('15 años')).toBeInTheDocument();
  });

  it('supports a compact desktop density for the carousel column', () => {
    const { container } = render(
      <PropertyReadOnlySections
        className='hidden xl:block'
        density='compact'
        propertyEngagement={propertyEngagement}
      />
    );

    expect(screen.getByTestId('property-read-only-sections')).toHaveClass(
      'space-y-4',
      'hidden',
      'xl:block'
    );
    expect(container.querySelector('[data-slot="property-read-only-field"]')).toHaveClass(
      'p-2',
      'sm:p-2.5'
    );
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
