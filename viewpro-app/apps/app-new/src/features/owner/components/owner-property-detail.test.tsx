import { render, screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OwnerPropertyDetail } from './owner-property-detail';
import type { OwnerEngagementsResponse, OwnerProperty, OwnerTimelineResponse } from '../api/types';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQuery: vi.fn()
  };
});

const useQueryMock = vi.mocked(useQuery);

const ownerProperty: OwnerProperty = {
  id: 'property-1',
  title: 'Casa familiar con pileta en Villa Centenario',
  addressLine: 'Av. Siempre Viva 123',
  city: 'Córdoba',
  province: 'Córdoba',
  propertyType: 'HOUSE',
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z'
};

const engagementsResponse: OwnerEngagementsResponse = [
  {
    id: 'engagement-1',
    tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' },
    operationType: 'SALE',
    status: 'ACTIVE_PUBLICATION',
    publishedPriceCents: 120_000_000,
    currency: 'USD',
    agents: [{ userId: 'agent-1', firstName: 'Sofía', email: 'sofia.demo@viewpro.local' }],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z'
  }
];

const timelineResponse: OwnerTimelineResponse = {
  engagement: engagementsResponse[0],
  items: [
    {
      id: 'movement-1',
      propertyEngagementId: 'engagement-1',
      type: 'GENERAL_UPDATE',
      observation: 'Ingresó una consulta calificada desde el portal inmobiliario.',
      nextStep: 'Coordinar visita con el interesado.',
      previousStatus: null,
      newStatus: null,
      source: 'MANUAL',
      interestCount: 2,
      visitCount: 1,
      offerAmountCents: null,
      interestLevel: 'HIGH',
      createdBy: { id: 'agent-1', email: 'sofia.demo@viewpro.local', firstName: 'Sofía' },
      createdAt: '2026-05-24T10:00:00.000Z'
    }
  ],
  page: 1,
  pageSize: 10,
  total: 1
};

describe('OwnerPropertyDetail', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
  });

  it('renders owner property detail and read-only timeline without internal actions', () => {
    useQueryMock
      .mockReturnValueOnce({ data: ownerProperty, isError: false, isLoading: false } as ReturnType<
        typeof useQuery
      >)
      .mockReturnValueOnce({ data: engagementsResponse, isError: false, isLoading: false } as ReturnType<
        typeof useQuery
      >)
      .mockReturnValueOnce({ data: timelineResponse, isError: false, isLoading: false } as ReturnType<
        typeof useQuery
      >);

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(
      screen.getByRole('heading', { name: /Casa familiar con pileta en Villa Centenario/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Gestión con\s+ViewPro Demo Inmobiliaria/i)).toBeInTheDocument();
    expect(screen.getAllByText('Sofía').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ingresó una consulta calificada/i)).toBeInTheDocument();
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Crear')).not.toBeInTheDocument();
  });
});
