import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueries, useQuery } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ownerService from '../api/service';
import type { OwnerEngagementsResponse, OwnerPropertiesResponse } from '../api/types';
import { OwnerHome } from './owner-home';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQueries: vi.fn(),
    useQuery: vi.fn()
  };
});

const useQueriesMock = vi.mocked(useQueries);
const useQueryMock = vi.mocked(useQuery);

const ownerPropertiesResponse: OwnerPropertiesResponse = [
  buildOwnerProperty({
    id: 'property-1',
    title: 'Casa familiar con pileta en Villa Centenario'
  })
];

const singleAgencyEngagements: OwnerEngagementsResponse = [
  buildOwnerEngagement({ tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' } })
];

describe('OwnerHome', () => {
  beforeEach(() => {
    useQueriesMock.mockReset();
    useQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders owner-visible property cards without internal creation actions', () => {
    mockOwnerHomeData(ownerPropertiesResponse, [singleAgencyEngagements]);

    render(<OwnerHome />);

    expect(screen.getByRole('heading', { name: /Tus propiedades/i })).toBeInTheDocument();
    expect(screen.getByText('Casa familiar con pileta en Villa Centenario')).toBeInTheDocument();
    expect(screen.getByText('Inmobiliaria vinculada')).toBeInTheDocument();
    expect(screen.getAllByText('ViewPro Demo Inmobiliaria').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Inmobiliaria/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver seguimiento/i })).toHaveAttribute(
      'href',
      '/owner/properties/property-1'
    );
  });

  it('renders an agency selector and filters properties when the owner has multiple agencies', () => {
    mockOwnerHomeData(
      [
        buildOwnerProperty({ id: 'property-1', title: 'Casa visible por ViewPro' }),
        buildOwnerProperty({ id: 'property-2', title: 'Casa visible por Otra Inmobiliaria' })
      ],
      [
        [buildOwnerEngagement({ tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' } })],
        [buildOwnerEngagement({ tenant: { id: 'tenant-2', name: 'Otra Inmobiliaria' } })]
      ]
    );

    render(<OwnerHome />);

    expect(screen.getByRole('combobox', { name: /Inmobiliaria/i })).toBeInTheDocument();
    expect(screen.getByText('Seleccioná inmobiliaria')).toBeInTheDocument();
    expect(screen.getByText('Casa visible por Otra Inmobiliaria')).toBeInTheDocument();
    expect(screen.queryByText('Casa visible por ViewPro')).not.toBeInTheDocument();
  });

  it('renders a WhatsApp contact link and tracks clicks best-effort', async () => {
    const trackingSpy = vi
      .spyOn(ownerService, 'trackOwnerWhatsappContactClick')
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockOwnerHomeData(ownerPropertiesResponse, [singleAgencyEngagements]);

    render(<OwnerHome />);

    const contactLink = screen.getByRole('link', { name: /Contactar inmobiliaria/i });

    expect(contactLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/5493510000000?text=')
    );
    expect(contactLink).toHaveAttribute('target', '_blank');
    expect(contactLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(contactLink).toHaveAttribute('href', expect.not.stringContaining('mailto:'));
    expect(contactLink).toHaveAttribute('href', expect.not.stringContaining('+'));
    expect(contactLink).toHaveAttribute(
      'href',
      expect.stringContaining('Av.%20Siempre%20Viva%20123')
    );

    await user.click(contactLink);

    expect(trackingSpy).toHaveBeenCalledWith('engagement-tenant-1');
  });

  it('renders an unavailable contact state when tenant WhatsApp is not configured', () => {
    mockOwnerHomeData(ownerPropertiesResponse, [
      [
        buildOwnerEngagement({
          contact: {
            available: false,
            targetType: 'tenant',
            displayLabel: 'Contacto no configurado'
          },
          tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' }
        })
      ]
    ]);

    render(<OwnerHome />);

    expect(screen.getByRole('button', { name: /Contacto no configurado/i })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /Contactar inmobiliaria/i })).not.toBeInTheDocument();
  });

  it('renders an owner-safe empty state', () => {
    mockOwnerHomeData([], []);

    render(<OwnerHome />);

    expect(screen.getByText('Todavía no tenés propiedades activas')).toBeInTheDocument();
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
  });
});

function mockOwnerHomeData(
  properties: OwnerPropertiesResponse,
  engagementsByProperty: OwnerEngagementsResponse[]
) {
  useQueryMock.mockReturnValue({
    data: properties,
    isError: false,
    isLoading: false
  } as ReturnType<typeof useQuery>);
  useQueriesMock.mockReturnValue(
    engagementsByProperty.map((engagements) => ({
      data: engagements,
      isError: false,
      isLoading: false
    })) as ReturnType<typeof useQueries>
  );
}

function buildOwnerProperty(input: { id: string; title: string }) {
  return {
    id: input.id,
    title: input.title,
    addressLine: 'Av. Siempre Viva 123',
    city: 'Córdoba',
    province: 'Córdoba',
    propertyType: 'HOUSE',
    totalAreaSqm: 360,
    coveredAreaSqm: 231,
    rooms: 7,
    bedrooms: 6,
    bathrooms: 2,
    garages: 2,
    ageYears: 25,
    orientation: 'N',
    images: [],
    primaryImage: null,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z'
  };
}

function buildOwnerEngagement(input: {
  contact?: OwnerEngagementsResponse[number]['contact'];
  tenant: { id: string; name: string };
}) {
  return {
    id: `engagement-${input.tenant.id}`,
    tenant: input.tenant,
    contact: input.contact ?? {
      available: true,
      targetType: 'tenant',
      displayLabel: 'Contactar inmobiliaria',
      whatsappPhone: '+5493510000000'
    },
    operationType: 'SALE',
    status: 'ACTIVE_PUBLICATION',
    publishedPriceCents: 100_000_000,
    currency: 'ARS',
    agents: [],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z'
  };
}
