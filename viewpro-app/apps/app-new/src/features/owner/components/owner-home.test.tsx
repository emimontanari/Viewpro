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
    addressLine: 'Villa Centenario',
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
    expect(screen.getByRole('heading', { name: 'Casa familiar con pileta' })).toHaveClass(
      'line-clamp-2'
    );
    expect(
      screen.queryByText('Casa familiar con pileta en Villa Centenario')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Villa Centenario, Córdoba')).toBeInTheDocument();
    expect(screen.getByText('Inmobiliaria vinculada')).toHaveClass(
      'text-[10px]',
      'text-muted-foreground',
      'uppercase'
    );
    expect(screen.getByText('VI')).toHaveClass('size-12', 'rounded-xl');
    expect(screen.getByRole('heading', { name: 'ViewPro Demo Inmobiliaria' })).toHaveClass(
      'line-clamp-2',
      'text-base'
    );
    expect(screen.getByLabelText('Inmobiliaria verificada')).toHaveClass(
      'size-3.5',
      'text-emerald-700',
      'dark:text-emerald-300'
    );
    expect(screen.getByText('Gestionando 1 propiedad para vos.')).toHaveClass(
      'text-[13.5px]',
      'text-muted-foreground'
    );
    const accessStatus = screen.getByText('Acceso vigente');
    expect(accessStatus).toHaveClass(
      'text-[12.5px]',
      'font-medium',
      'text-emerald-700',
      'dark:text-emerald-300'
    );
    expect(accessStatus.firstElementChild).toHaveClass('size-1.5', 'bg-emerald-500');
    expect(accessStatus).not.toHaveClass('rounded-full', 'border', 'bg-emerald-500/10');
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /Inmobiliaria/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ver seguimiento/i })).toHaveAttribute(
      'href',
      '/owner/properties/property-1?tab=tracking'
    );
    expect(screen.getByRole('link', { name: /Ver documentación/i })).toHaveAttribute(
      'href',
      '/owner/properties/property-1?tab=documents'
    );
    expect(screen.getByText('Documentación')).toBeInTheDocument();
    expect(screen.queryByText('Ficha técnica')).not.toBeInTheDocument();
    expect(screen.getByText('Publicación activa')).toBeInTheDocument();
    expect(screen.getByText('Progreso de gestión')).toBeInTheDocument();
    expect(screen.getByText('44%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /Progreso según etapa/i })).toHaveAttribute(
      'aria-valuenow',
      '44'
    );
    expect(screen.getByRole('progressbar', { name: /Progreso según etapa/i })).toHaveAttribute(
      'aria-valuemin',
      '0'
    );
    expect(screen.getByRole('progressbar', { name: /Progreso según etapa/i })).toHaveAttribute(
      'aria-valuemax',
      '100'
    );
  });

  it('deduplicates visual location and removes trailing neighborhood from the card title', () => {
    mockOwnerHomeData(
      [
        buildOwnerProperty({
          addressLine: 'Villa Centenario',
          city: 'Córdoba',
          id: 'property-1',
          province: 'Córdoba',
          title: 'Casa familiar con pileta en Villa Centenario'
        })
      ],
      [singleAgencyEngagements]
    );

    render(<OwnerHome />);

    expect(screen.getByRole('heading', { name: 'Casa familiar con pileta' })).toBeInTheDocument();
    expect(screen.getByText('Villa Centenario, Córdoba')).toBeInTheDocument();
    expect(screen.queryByText('Villa Centenario, Córdoba, Córdoba')).not.toBeInTheDocument();
  });

  it('keeps non-location title suffixes visible', () => {
    mockOwnerHomeData(
      [
        buildOwnerProperty({
          addressLine: 'Villa Centenario',
          city: 'Córdoba',
          id: 'property-1',
          province: 'Córdoba',
          title: 'Departamento en Venta'
        })
      ],
      [singleAgencyEngagements]
    );

    render(<OwnerHome />);

    expect(screen.getByRole('heading', { name: 'Departamento en Venta' })).toBeInTheDocument();
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
    expect(contactLink).toHaveAttribute('href', expect.stringContaining('Villa%20Centenario'));

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

    const contactButton = screen.getByRole('button', { name: 'Contacto — no configurado' });

    expect(contactButton).toBeDisabled();
    expect(contactButton).toHaveClass('h-20', 'w-full');
    expect(contactButton.parentElement).toHaveClass('grid-cols-3');
    expect(screen.getByText('Contacto')).toBeInTheDocument();
    expect(screen.queryByText('Contacto no configurado')).not.toBeInTheDocument();
    expect(screen.getByTestId('owner-contact-unavailable-indicator')).toHaveClass('bg-destructive');
    expect(screen.getByRole('link', { name: /Ver seguimiento/i })).toHaveClass('h-20', 'w-full');
    expect(screen.getByRole('link', { name: /Ver documentación/i })).toHaveClass('h-20', 'w-full');
    expect(screen.queryByRole('link', { name: /Contactar inmobiliaria/i })).not.toBeInTheDocument();
  });

  it('renders the contact button as disabled and does not wire the tracking call site (sentinel)', async () => {
    const user = userEvent.setup();
    const trackingSpy = vi
      .spyOn(ownerService, 'trackOwnerWhatsappContactClick')
      .mockResolvedValue(undefined);
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

    const contactButton = screen.getByRole('button', { name: 'Contacto — no configurado' });

    expect(contactButton).toBeDisabled();
    // Act step: attempt to click the disabled button. The disabled attribute should
    // swallow the click in jsdom AND the onClick should not be wired to the tracking
    // call site when contact.available is false. If anyone removes the disabled
    // attribute OR wires onClick to the disabled state, this sentinel fails.
    await user.click(contactButton);
    expect(trackingSpy).not.toHaveBeenCalled();
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

function buildOwnerProperty(input: {
  addressLine?: string;
  city?: string;
  id: string;
  province?: string;
  title: string;
}) {
  return {
    id: input.id,
    title: input.title,
    addressLine: input.addressLine ?? 'Av. Siempre Viva 123',
    city: input.city ?? 'Córdoba',
    province: input.province ?? 'Córdoba',
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
