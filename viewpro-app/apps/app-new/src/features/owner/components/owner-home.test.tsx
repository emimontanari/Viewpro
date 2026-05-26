import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OwnerHome } from './owner-home';
import type { OwnerPropertiesResponse } from '../api/types';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQuery: vi.fn()
  };
});

const useQueryMock = vi.mocked(useQuery);

const ownerPropertiesResponse: OwnerPropertiesResponse = [
  {
    id: 'property-1',
    title: 'Casa familiar con pileta en Villa Centenario',
    addressLine: 'Av. Siempre Viva 123',
    city: 'Córdoba',
    province: 'Córdoba',
    propertyType: 'HOUSE',
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z'
  }
];

describe('OwnerHome', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it('renders owner-visible property cards without internal creation actions', () => {
    useQueryMock.mockReturnValue({
      data: ownerPropertiesResponse,
      isError: false,
      isLoading: false
    } as ReturnType<typeof useQuery>);

    render(<OwnerHome />);

    expect(screen.getByRole('heading', { name: /Tus propiedades/i })).toBeInTheDocument();
    expect(screen.getByText('Casa familiar con pileta en Villa Centenario')).toBeInTheDocument();
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver seguimiento/i })).toHaveAttribute(
      'href',
      '/owner/properties/property-1'
    );
  });

  it('renders an owner-safe empty state', () => {
    useQueryMock.mockReturnValue({
      data: [],
      isError: false,
      isLoading: false
    } as ReturnType<typeof useQuery>);

    render(<OwnerHome />);

    expect(screen.getByText('Todavía no tenés propiedades activas')).toBeInTheDocument();
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
  });
});
