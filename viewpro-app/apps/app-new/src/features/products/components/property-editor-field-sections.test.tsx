import { useAppForm } from '@/components/ui/tanstack-form';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { productSchema, type ProductFormValues } from '../schemas/product';
import {
  PropertyBasicFields,
  PropertyCharacteristicsFields,
  PropertyOwnerReferenceFields
} from './property-editor-field-sections';

describe('PropertyBasicFields', () => {
  it('renders the commercial and address fields with existing copy', () => {
    renderWithForm(<PropertyBasicFields />);

    expect(screen.getByText(/Título/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Departamento en Palermo')).toBeInTheDocument();
    expect(screen.getByText(/Tipo de propiedad/)).toBeInTheDocument();
    expect(screen.getByText(/Dirección/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Av. Santa Fe 1234')).toBeInTheDocument();
    expect(screen.getByText(/Ciudad/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('CABA')).toBeInTheDocument();
    expect(screen.getByText(/Provincia/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText(/Operación/)).toBeInTheDocument();
  });
});

describe('PropertyCharacteristicsFields', () => {
  it('renders the characteristics section and physical-property fields', () => {
    renderWithForm(<PropertyCharacteristicsFields />);

    expect(screen.getByText('Características')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Datos físicos opcionales de la propiedad. Podés completarlos ahora o más adelante.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Superficie total')).toBeInTheDocument();
    expect(screen.getByText('m² totales')).toBeInTheDocument();
    expect(screen.getByText('Superficie cubierta')).toBeInTheDocument();
    expect(screen.getByText('m² cubiertos')).toBeInTheDocument();
    expect(screen.getByText('Ambientes')).toBeInTheDocument();
    expect(screen.getByText('Dormitorios')).toBeInTheDocument();
    expect(screen.getByText('Baños')).toBeInTheDocument();
    expect(screen.getByText('Cocheras')).toBeInTheDocument();
    expect(screen.getByText('Antigüedad')).toBeInTheDocument();
    expect(screen.getByText('Años')).toBeInTheDocument();
    expect(screen.getByText('Orientación')).toBeInTheDocument();
  });
});

describe('PropertyOwnerReferenceFields', () => {
  it('renders owner reference fields', () => {
    renderWithForm(<PropertyOwnerReferenceFields />);

    expect(screen.getByText('Propietario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nombre del propietario')).toBeInTheDocument();
    expect(screen.getByText('Email del propietario')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('propietario@email.com')).toBeInTheDocument();
  });
});

function renderWithForm(children: ReactNode) {
  return render(<FormHarness>{children}</FormHarness>);
}

function FormHarness({ children }: { children: ReactNode }) {
  const form = useAppForm({
    defaultValues: createFormValues(),
    validators: { onSubmit: productSchema },
    onSubmit: vi.fn()
  });

  return <form.AppForm>{children}</form.AppForm>;
}

function createFormValues(): ProductFormValues {
  return {
    addressLine: '',
    city: '',
    currency: 'ARS',
    image: [],
    operationType: 'SALE',
    ownerEmail: '',
    ownerName: '',
    propertyType: 'APARTMENT',
    province: '',
    title: ''
  } as ProductFormValues;
}
