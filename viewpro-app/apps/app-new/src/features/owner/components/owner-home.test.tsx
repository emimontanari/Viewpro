import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQueries, useQuery } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ownerService from '../api/service';
import type {
  OwnerEngagementsResponse,
  OwnerMovement,
  OwnerPropertiesResponse
} from '../api/types';
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
    expect(screen.getByRole('link', { name: /1\. Actividad reciente/i })).toHaveAttribute(
      'href',
      '/owner/properties/property-1?engagement=engagement-tenant-1&tab=tracking'
    );
    expect(screen.getByRole('link', { name: /2\. Documentación/i })).toHaveAttribute(
      'href',
      '/owner/properties/property-1?engagement=engagement-tenant-1&tab=documents'
    );
    expect(screen.getByRole('link', { name: /2\. Documentación/i })).toBeInTheDocument();
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

    it('renders exactly three ordered, accessible primary engagement actions and a scoped secondary detail link', () => {
      mockOwnerHomeData(ownerPropertiesResponse, [singleAgencyEngagements]);

      render(<OwnerHome />);

      const actionGroup = screen.getByTestId('owner-engagement-actions');
      const activity = screen.getByRole('link', {
        name: /1\. Actividad reciente\s*Seguí las acciones informadas para esta gestión\./
      });
      const documents = screen.getByRole('link', {
        name: /2\. Documentación\s*Accedé a los documentos de esta gestión\./
      });
      const contact = screen.getByRole('link', {
        name: /3\. Comunicarme con mi asesor\s*Escribile a tu inmobiliaria por WhatsApp\./
      });
      const primaryActions = [activity, documents, contact];

      expect(actionGroup.querySelectorAll(':scope > a, :scope > button')).toHaveLength(3);
      expect(primaryActions.map((action) => action.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
        '1. Actividad recienteSeguí las acciones informadas para esta gestión.',
        '2. DocumentaciónAccedé a los documentos de esta gestión.',
        '3. Comunicarme con mi asesorEscribile a tu inmobiliaria por WhatsApp.'
      ]);
      expect(actionGroup).toHaveClass(
        'grid-cols-1',
        'md:grid-cols-[repeat(3,minmax(0,1fr))]'
      );
      expect(activity).toHaveAttribute(
        'href',
        '/owner/properties/property-1?engagement=engagement-tenant-1&tab=tracking'
      );
      expect(documents).toHaveAttribute(
        'href',
        '/owner/properties/property-1?engagement=engagement-tenant-1&tab=documents'
      );
      expect(contact).toHaveAttribute('href', expect.stringContaining('https://wa.me/5493510000000'));

      for (const action of primaryActions) {
        expect(action.tagName).toBe('A');
        expect(action).toHaveClass('min-h-11');
        expect(action.querySelectorAll('a, button')).toHaveLength(0);
        expect(action.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
      }

      const detail = screen.getByRole('link', { name: 'Ver más' });
      expect(detail).toHaveAttribute(
        'href',
        '/owner/properties/property-1?engagement=engagement-tenant-1'
      );
      expect(detail).toHaveClass('min-h-11');
      expect(detail.querySelectorAll('a, button')).toHaveLength(0);
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

  it('offers an agency filter without hiding engagements by default', () => {
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
    expect(
      screen.getByRole('heading', { name: 'Casa visible por Otra Inmobiliaria' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Casa visible por ViewPro' })).toBeInTheDocument();
  });

  it('renders one card per engagement when a property is worked by two agencies', () => {
    mockOwnerHomeData(
      [buildOwnerProperty({ id: 'property-1', title: 'Casa compartida' })],
      [
        [
          buildOwnerEngagement({ tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' } }),
          buildOwnerEngagement({ tenant: { id: 'tenant-2', name: 'Otra Inmobiliaria' } })
        ]
      ]
    );

    render(<OwnerHome />);

    const detailLinks = screen.getAllByRole('link', { name: 'Ver más' });

    expect(detailLinks).toHaveLength(2);
    expect(detailLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/owner/properties/property-1?engagement=engagement-tenant-1',
      '/owner/properties/property-1?engagement=engagement-tenant-2'
    ]);
    expect(screen.getByText('Gestión con ViewPro Demo Inmobiliaria')).toBeInTheDocument();
    expect(screen.getByText('Gestión con Otra Inmobiliaria')).toBeInTheDocument();
  });

  it('never borrows activity from another agency engagement', () => {
    mockOwnerHomeData(
      [buildOwnerProperty({ id: 'property-1', title: 'Casa compartida' })],
      [
        [
          buildOwnerEngagement({ tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' } }),
          buildOwnerEngagement({ tenant: { id: 'tenant-2', name: 'Otra Inmobiliaria' } })
        ]
      ],
      {
        'engagement-tenant-1': buildOwnerMovement({
          createdAt: '2026-08-20T10:00:00.000Z',
          nextStep: 'Coordinar firma de reserva',
          observation: 'Recibimos una oferta formal'
        })
      }
    );

    render(<OwnerHome />);

    expect(screen.getByText('Recibimos una oferta formal')).toBeInTheDocument();
    expect(screen.getByText('Coordinar firma de reserva')).toBeInTheDocument();
    expect(screen.getAllByText('Recibimos una oferta formal')).toHaveLength(1);
    expect(screen.getByText('Todavía no hay movimientos registrados.')).toBeInTheDocument();
    expect(screen.getByText('Sin próxima acción informada.')).toBeInTheDocument();
  });

  it('states the missing next action while still showing the latest movement', () => {
    mockOwnerHomeData(ownerPropertiesResponse, [singleAgencyEngagements], {
      'engagement-tenant-1': buildOwnerMovement({
        createdAt: '2026-08-20T10:00:00.000Z',
        nextStep: null,
        observation: 'Publicamos la propiedad'
      })
    });

    render(<OwnerHome />);

    expect(screen.getByText('Publicamos la propiedad')).toBeInTheDocument();
    expect(screen.getByText('Sin próxima acción informada.')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay movimientos registrados.')).not.toBeInTheDocument();
  });

  it('orders cards by latest movement date and breaks ties by engagement id', () => {
    const sameTimestamp = '2026-08-18T12:00:00.000Z';
    mockOwnerHomeData(
      [
        buildOwnerProperty({ id: 'property-1', title: 'Casa sin movimientos' }),
        buildOwnerProperty({ id: 'property-2', title: 'Casa empatada z' }),
        buildOwnerProperty({ id: 'property-3', title: 'Casa empatada a' }),
        buildOwnerProperty({ id: 'property-4', title: 'Casa más reciente' })
      ],
      [
        [buildOwnerEngagement({ tenant: { id: 'silent', name: 'Sin actividad' } })],
        [buildOwnerEngagement({ tenant: { id: 'tie-z', name: 'Empate Z' } })],
        [buildOwnerEngagement({ tenant: { id: 'tie-a', name: 'Empate A' } })],
        [buildOwnerEngagement({ tenant: { id: 'recent', name: 'Reciente' } })]
      ],
      {
            'engagement-tie-z': buildOwnerMovement({
              createdAt: sameTimestamp,
              propertyEngagementId: 'engagement-tie-z'
            }),
            'engagement-tie-a': buildOwnerMovement({
              createdAt: sameTimestamp,
              propertyEngagementId: 'engagement-tie-a'
            }),
            'engagement-recent': buildOwnerMovement({
              createdAt: '2026-08-22T12:00:00.000Z',
              propertyEngagementId: 'engagement-recent'
            })
      }
    );

    render(<OwnerHome />);

    const renderedTitles = screen
      .getAllByRole('link', { name: 'Ver más' })
      .map((link) => link.getAttribute('href'));

    expect(renderedTitles).toEqual([
      '/owner/properties/property-4?engagement=engagement-recent',
      '/owner/properties/property-3?engagement=engagement-tie-a',
      '/owner/properties/property-2?engagement=engagement-tie-z',
      '/owner/properties/property-1?engagement=engagement-silent'
    ]);
  });

  it('states that activity could not be loaded instead of claiming there is none', () => {
    useQueryMock.mockReturnValue({
      data: ownerPropertiesResponse,
      isError: false,
      isLoading: false
    } as ReturnType<typeof useQuery>);
    useQueriesMock.mockImplementation((options) => {
      const queries = (options as { queries: Array<{ queryKey: readonly unknown[] }> }).queries;

      return queries.map((query) =>
        query.queryKey.includes('timeline')
          ? { data: undefined, isError: true, isLoading: false }
          : { data: singleAgencyEngagements, isError: false, isLoading: false }
      ) as ReturnType<typeof useQueries>;
    });

    render(<OwnerHome />);

    expect(screen.getByText('No pudimos cargar la actividad de esta gestión.')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay movimientos registrados.')).not.toBeInTheDocument();
  });

  it('renders a WhatsApp contact link and tracks clicks best-effort', async () => {
    const trackingSpy = vi
      .spyOn(ownerService, 'trackOwnerWhatsappContactClick')
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    mockOwnerHomeData(ownerPropertiesResponse, [singleAgencyEngagements]);

    render(<OwnerHome />);

    const contactLink = screen.getByRole('link', { name: /3\. Comunicarme con mi asesor/i });

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

      it('keeps scoped navigation and agency contact isolated across two engagements', async () => {
        const trackingSpy = vi
          .spyOn(ownerService, 'trackOwnerWhatsappContactClick')
          .mockResolvedValue(undefined);
        const user = userEvent.setup();
        mockOwnerHomeData(
          [buildOwnerProperty({ id: 'property-1', title: 'Casa compartida' })],
          [
            [
              buildOwnerEngagement({ tenant: { id: 'tenant-1', name: 'Agencia Uno' } }),
              buildOwnerEngagement({
                contact: {
                  available: true,
                  targetType: 'tenant',
                  displayLabel: 'Contactar Agencia Dos',
                  whatsappPhone: '+5493519999999'
                },
                tenant: { id: 'tenant-2', name: 'Agencia Dos' }
              })
            ]
          ],
          {
            'engagement-tenant-1': buildOwnerMovement({
              createdAt: '2026-08-20T10:00:00.000Z',
              propertyEngagementId: 'engagement-tenant-1'
            }),
            'engagement-tenant-2': buildOwnerMovement({
              createdAt: '2026-08-19T10:00:00.000Z',
              propertyEngagementId: 'engagement-tenant-2'
            })
          }
        );

        render(<OwnerHome />);

        expect(
          screen
            .getAllByRole('link', { name: /1\. Actividad reciente/i })
            .map((link) => link.getAttribute('href'))
        ).toEqual([
          '/owner/properties/property-1?engagement=engagement-tenant-1&tab=tracking',
          '/owner/properties/property-1?engagement=engagement-tenant-2&tab=tracking'
        ]);
        expect(
          screen
            .getAllByRole('link', { name: /2\. Documentación/i })
            .map((link) => link.getAttribute('href'))
        ).toEqual([
          '/owner/properties/property-1?engagement=engagement-tenant-1&tab=documents',
          '/owner/properties/property-1?engagement=engagement-tenant-2&tab=documents'
        ]);
        expect(
          screen.getAllByRole('link', { name: 'Ver más' }).map((link) => link.getAttribute('href'))
        ).toEqual([
          '/owner/properties/property-1?engagement=engagement-tenant-1',
          '/owner/properties/property-1?engagement=engagement-tenant-2'
        ]);

        const contactLinks = screen.getAllByRole('link', { name: /3\. Comunicarme con mi asesor/i });
        expect(contactLinks.map((link) => link.getAttribute('href'))).toEqual([
          expect.stringContaining('5493510000000'),
          expect.stringContaining('5493519999999')
        ]);
        expect(contactLinks.map((link) => link.getAttribute('href'))).not.toEqual(
          expect.arrayContaining([expect.stringContaining('5493510000001')])
        );

        await user.click(contactLinks[1]!);
        expect(trackingSpy).toHaveBeenCalledWith('engagement-tenant-2');
      });

      it('renders an unavailable contact state when tenant WhatsApp is not configured', () => {
        mockOwnerHomeData(ownerPropertiesResponse, [
          [
            buildOwnerEngagement({
              contact: {
                available: true,
                targetType: 'tenant',
                displayLabel: 'Contacto no configurado',
                whatsappPhone: undefined
              },
          tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' }
        })
      ]
    ]);

    render(<OwnerHome />);

    const contactButton = screen.getByRole('button', { name: /3\. Comunicarme con mi asesor/i });

    expect(contactButton).toBeDisabled();
    expect(contactButton).toHaveClass('min-h-11');
    expect(contactButton).toHaveTextContent('WhatsApp no configurado por la inmobiliaria.');
    expect(screen.getByRole('link', { name: /1\. Actividad reciente/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('link', { name: /2\. Documentación/i })).toHaveClass('min-h-11');
    expect(screen.queryByRole('link', { name: /3\. Comunicarme con mi asesor/i })).not.toBeInTheDocument();
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

    const contactButton = screen.getByRole('button', { name: /3\. Comunicarme con mi asesor/i });

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
  engagementsByProperty: OwnerEngagementsResponse[],
  latestMovementByEngagementId: Record<string, OwnerMovement> = {}
) {
  useQueryMock.mockReturnValue({
    data: properties,
    isError: false,
    isLoading: false
  } as ReturnType<typeof useQuery>);
  useQueriesMock.mockImplementation((options) => {
    const queries = (options as { queries: Array<{ queryKey: readonly unknown[] }> }).queries;

    return queries.map((query, index) => {
      if (isTimelineQueryKey(query.queryKey)) {
        const movement = latestMovementByEngagementId[String(query.queryKey[2])];

        return {
          data: {
            items: movement ? [movement] : [],
            page: 1,
            pageSize: 1,
            total: movement ? 1 : 0
          },
          isError: false,
          isLoading: false
        };
      }

      return { data: engagementsByProperty[index], isError: false, isLoading: false };
    }) as ReturnType<typeof useQueries>;
  });
}

function isTimelineQueryKey(queryKey: readonly unknown[]) {
  return queryKey.includes('timeline');
}

function buildOwnerMovement(input: {
  createdAt: string;
  nextStep?: string | null;
  observation?: string;
  propertyEngagementId?: string;
}): OwnerMovement {
  return {
    id: `movement-${input.createdAt}`,
    propertyEngagementId: input.propertyEngagementId ?? 'engagement-tenant-1',
    type: 'STATUS_CHANGE',
    observation: input.observation ?? 'Movimiento visible para el propietario',
    nextStep: input.nextStep ?? null,
    previousStatus: null,
    newStatus: null,
    source: 'AGENCY',
    interestCount: null,
    visitCount: null,
    offerAmountCents: null,
    interestLevel: null,
    createdBy: { id: 'user-1', email: 'agente@viewpro.test', firstName: 'Agente' },
    contact: {
      available: true,
      targetType: 'assigned_seller',
      displayLabel: 'Contactar vendedor',
      whatsappPhone: '+5493510000001'
    },
    createdAt: input.createdAt
  };
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
