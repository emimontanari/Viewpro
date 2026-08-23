import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OwnerEngagementsResponse, OwnerProperty, OwnerTimelineResponse } from '../api/types';
import { OwnerPropertyDetail } from './owner-property-detail';

const nuqsMockState = vi.hoisted(() => ({
  initialTab: undefined as string | undefined,
  initialDoc: null as string | null,
  initialEngagement: null as string | null
}));

vi.mock('./owner-document-requests', () => ({
  OwnerDocumentRequests: ({
    hideAgencyInDocumentCards,
    highlightDocId,
    propertyEngagementId
  }: {
    hideAgencyInDocumentCards?: boolean;
    highlightDocId?: string | null;
    propertyEngagementId: string;
  }) => (
    <div
      data-hide-agency={hideAgencyInDocumentCards}
      data-highlight-doc={highlightDocId ?? ''}
      data-testid='owner-document-requests'
    >
      Documentos de {propertyEngagementId}
    </div>
  )
}));

vi.mock('nuqs', async () => {
  const React = await import('react');

  return {
    parseAsString: {
      withOptions: () => ({
        withDefault: (defaultValue: string) => ({ defaultValue })
      })
    },
    // Each nuqs param is modelled by its own independent state slot, mirroring nuqs'
    // shallow per-key URL writes: a `tab` write never touches the `doc` slot. Hooks are
    // called unconditionally (one fixed order) so the mock obeys the rules of hooks.
    useQueryState: (key: string, parser: { defaultValue?: string }) => {
      const tabState = React.useState<string>(
        nuqsMockState.initialTab ?? parser.defaultValue ?? 'summary'
      );
      const docState = React.useState<string | null>(nuqsMockState.initialDoc);
      const engagementState = React.useState<string | null>(nuqsMockState.initialEngagement);
      const fallbackState = React.useState<string | null>(parser.defaultValue ?? null);

      if (key === 'tab') {
        return tabState;
      }
      if (key === 'doc') {
        return docState;
      }
      if (key === 'engagement') {
        return engagementState;
      }
      return fallbackState;
    }
  };
});

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQuery: vi.fn(),
    useQueryClient: vi.fn()
  };
});

const useQueryMock = vi.mocked(useQuery);
const useQueryClientMock = vi.mocked(useQueryClient);
const prefetchQueryMock = vi.fn();

const ownerProperty: OwnerProperty = {
  id: 'property-1',
  title: 'Casa familiar con pileta en Villa Centenario',
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
  images: [
    {
      id: 'image-1',
      storageKey: 'property-images/demo/image-1.webp',
      url: 'http://localhost:3001/uploads/property-images/demo/image-1.webp',
      originalFilename: 'image-1.webp',
      mimeType: 'image/webp',
      sizeBytes: 1024,
      isPrimary: true,
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T10:00:00.000Z'
    }
  ],
  primaryImage: {
    id: 'image-1',
    storageKey: 'property-images/demo/image-1.webp',
    url: 'http://localhost:3001/uploads/property-images/demo/image-1.webp',
    originalFilename: 'image-1.webp',
    mimeType: 'image/webp',
    sizeBytes: 1024,
    isPrimary: true,
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-01T10:00:00.000Z'
  },
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-20T10:00:00.000Z'
};

const engagementsResponse: OwnerEngagementsResponse = [
  {
    id: 'engagement-1',
    tenant: { id: 'tenant-1', name: 'ViewPro Demo Inmobiliaria' },
    contact: {
      available: true,
      targetType: 'tenant',
      displayLabel: 'Contactar inmobiliaria',
      whatsappPhone: '+5493510000000'
    },
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
      contact: {
        available: true,
        targetType: 'assigned_seller',
        displayLabel: 'Consultar responsable',
        whatsappPhone: '+5493511112222'
      },
      createdAt: '2026-05-24T10:00:00.000Z'
    }
  ],
  page: 1,
  pageSize: 10,
  total: 1
};

describe('OwnerPropertyDetail', () => {
  beforeEach(() => {
    nuqsMockState.initialTab = undefined;
    nuqsMockState.initialDoc = null;
    nuqsMockState.initialEngagement = null;
    useQueryMock.mockReset();
    prefetchQueryMock.mockReset();
    useQueryClientMock.mockReturnValue({ prefetchQuery: prefetchQueryMock } as never);
  });

  it('renders owner property summary, tabs, status path and read-only timeline', async () => {
    const user = userEvent.setup();
    mockOwnerPropertyDetailQueries({ includeTimeline: true });

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(
      screen.getByRole('heading', { name: /Casa familiar con pileta en Villa Centenario/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Seguimiento' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeInTheDocument();
    expect(
      screen.getByAltText('Imagen 1 de 1 de Casa familiar con pileta en Villa Centenario')
    ).toBeInTheDocument();
    expect(screen.getByText('Ficha técnica')).toBeInTheDocument();
    expect(screen.getByText('Superficie cubierta')).toBeInTheDocument();
    expect(screen.getByText('231 m²')).toBeInTheDocument();
    expect(screen.getByText('Dormitorios')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText(/Gestión con\s+ViewPro Demo Inmobiliaria/i)).toBeInTheDocument();
    expect(screen.getAllByText('Sofía').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Seguimiento' }));

    expect(screen.getByText('Estado de la gestión')).toBeInTheDocument();
    expect(screen.getByText('Estado actual: Publicación activa')).toBeInTheDocument();
    expect(screen.getByText('Etapa actual')).toBeInTheDocument();
    expect(screen.getByText(/Ingresó una consulta calificada/i)).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Documentos' }));

    expect(screen.getByTestId('owner-document-requests')).toHaveTextContent(
      'Documentos de engagement-1'
    );
    expect(screen.getByTestId('owner-document-requests')).toHaveAttribute(
      'data-hide-agency',
      'true'
    );
    expect(screen.queryByText('Nueva propiedad')).not.toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Crear')).not.toBeInTheDocument();
    expect(prefetchQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['owner', 'document-requests', 'engagement-1', { pageSize: 20 }]
      })
    );
  });

  it('opens tracking directly from the tab query param', () => {
    nuqsMockState.initialTab = 'tracking';
    mockOwnerPropertyDetailQueries({ includeTimeline: true });

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByRole('tab', { name: 'Seguimiento' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText('Estado de la gestión')).toBeInTheDocument();
    expect(screen.getByText(/Ingresó una consulta calificada/i)).toBeInTheDocument();
  });

  it('opens documents directly from the tab query param', () => {
    nuqsMockState.initialTab = 'documents';
    mockOwnerPropertyDetailQueries();

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByRole('tab', { name: 'Documentos' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('owner-document-requests')).toHaveTextContent(
      'Documentos de engagement-1'
    );
  });

  it('falls back to summary for an invalid tab query param', () => {
    nuqsMockState.initialTab = 'unknown';
    mockOwnerPropertyDetailQueries();

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Ficha técnica')).toBeInTheDocument();
  });

  it('threads highlightDocId prop to OwnerDocumentRequests when doc param is set', () => {
    nuqsMockState.initialTab = 'documents';
    nuqsMockState.initialDoc = 'req-123';
    mockOwnerPropertyDetailQueries();

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByTestId('owner-document-requests')).toHaveAttribute(
      'data-highlight-doc',
      'req-123'
    );
  });

  it('threads null highlightDocId to OwnerDocumentRequests when doc param is absent', () => {
    nuqsMockState.initialTab = 'documents';
    nuqsMockState.initialDoc = null;
    mockOwnerPropertyDetailQueries();

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByTestId('owner-document-requests')).toHaveAttribute('data-highlight-doc', '');
  });

  // S-F5 — Risk A3 / FR-F2 / design D2: writing the `tab` param must NOT clobber `doc`.
  // The two nuqs params are registered independently; a Tabs change writes `tab` only,
  // so the threaded highlightDocId (`data-highlight-doc`) must still equal the doc value.
  it('S-F5: keeps the doc param when the user changes tabs (doc survives tab write)', async () => {
    const user = userEvent.setup();
    nuqsMockState.initialTab = 'documents';
    nuqsMockState.initialDoc = 'req-123';
    mockOwnerPropertyDetailQueries({ includeTimeline: true });

    render(<OwnerPropertyDetail propertyId='property-1' />);

    // Precondition: doc is threaded while on the documents tab.
    expect(screen.getByTestId('owner-document-requests')).toHaveAttribute(
      'data-highlight-doc',
      'req-123'
    );

    // User changes tabs — this fires the Tabs onValueChange which writes `tab` only.
    await user.click(screen.getByRole('tab', { name: 'Seguimiento' }));
    expect(screen.getByRole('tab', { name: 'Seguimiento' })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Back to documents: the doc param must NOT have been clobbered by the tab write.
    await user.click(screen.getByRole('tab', { name: 'Documentos' }));
    expect(screen.getByTestId('owner-document-requests')).toHaveAttribute(
      'data-highlight-doc',
      'req-123'
    );
  });

  it('scopes the detail to the engagement carried by the card link', async () => {
    const user = userEvent.setup();
    nuqsMockState.initialEngagement = 'engagement-2';
    mockOwnerPropertyDetailQueriesWithMultipleAgencies();

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByText('Inmobiliaria: Otra Inmobiliaria')).toBeInTheDocument();
    expect(screen.queryByText('Inmobiliaria: ViewPro Demo Inmobiliaria')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Seguimiento' }));

    expect(screen.getByText('Gestión con Otra Inmobiliaria')).toBeInTheDocument();
    expect(screen.queryByText('Gestión con ViewPro Demo Inmobiliaria')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Documentos' }));

    expect(screen.getByTestId('owner-document-requests')).toHaveTextContent(
      'Documentos de engagement-2'
    );
  });

  it('falls back to the default engagement when the scope does not match', async () => {
    const user = userEvent.setup();
    nuqsMockState.initialEngagement = 'engagement-from-another-property';
    mockOwnerPropertyDetailQueriesWithMultipleAgencies();

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(screen.getByText('Inmobiliaria: ViewPro Demo Inmobiliaria')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Seguimiento' }));

    expect(screen.getByText('Gestión con ViewPro Demo Inmobiliaria')).toBeInTheDocument();
    expect(screen.getByText('Gestión con Otra Inmobiliaria')).toBeInTheDocument();
  });

  it('renders property content while engagements are still loading', async () => {
    const user = userEvent.setup();
    useQueryMock.mockImplementation((options: { queryKey?: readonly unknown[] }) => {
      if (isOwnerEngagementsQuery(options.queryKey)) {
        return { data: undefined, isError: false, isLoading: true } as ReturnType<typeof useQuery>;
      }

      return { data: ownerProperty, isError: false, isLoading: false } as ReturnType<
        typeof useQuery
      >;
    });

    render(<OwnerPropertyDetail propertyId='property-1' />);

    expect(
      screen.getByRole('heading', { name: /Casa familiar con pileta en Villa Centenario/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Cargando seguimiento')).toBeInTheDocument();
    expect(
      screen.getByText('Estamos trayendo la gestión activa de esta propiedad.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Seguimiento' }));

    expect(screen.getByText('Cargando gestiones activas...')).toBeInTheDocument();
  });
});

const multiAgencyEngagementsResponse: OwnerEngagementsResponse = [
  engagementsResponse[0]!,
  {
    ...engagementsResponse[0]!,
    id: 'engagement-2',
    tenant: { id: 'tenant-2', name: 'Otra Inmobiliaria' },
    status: 'CAPTURE'
  }
];

function mockOwnerPropertyDetailQueries({
  includeTimeline = false
}: { includeTimeline?: boolean } = {}) {
  useQueryMock.mockImplementation((options: { queryKey?: readonly unknown[] }) => {
    if (isOwnerEngagementsQuery(options.queryKey)) {
      return {
        data: engagementsResponse,
        isError: false,
        isLoading: false
      } as ReturnType<typeof useQuery>;
    }

    if (isOwnerTimelineQuery(options.queryKey) && includeTimeline) {
      return {
        data: timelineResponse,
        isError: false,
        isLoading: false
      } as ReturnType<typeof useQuery>;
    }

    return { data: ownerProperty, isError: false, isLoading: false } as ReturnType<typeof useQuery>;
  });
}

function isOwnerEngagementsQuery(queryKey: readonly unknown[] | undefined) {
  return queryKey?.includes('engagements') && queryKey.includes('property-1');
}

function isOwnerTimelineQuery(queryKey: readonly unknown[] | undefined) {
  return queryKey?.includes('timeline');
}

function mockOwnerPropertyDetailQueriesWithMultipleAgencies() {
  useQueryMock.mockImplementation((options: { queryKey?: readonly unknown[] }) => {
    if (isOwnerEngagementsQuery(options.queryKey)) {
      return {
        data: multiAgencyEngagementsResponse,
        isError: false,
        isLoading: false
      } as ReturnType<typeof useQuery>;
    }

    if (isOwnerTimelineQuery(options.queryKey)) {
      return {
        data: { ...timelineResponse, items: [] },
        isError: false,
        isLoading: false
      } as ReturnType<typeof useQuery>;
    }

    return { data: ownerProperty, isError: false, isLoading: false } as ReturnType<typeof useQuery>;
  });
}
