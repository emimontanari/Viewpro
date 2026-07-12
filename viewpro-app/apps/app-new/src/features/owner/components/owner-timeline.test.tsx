import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as ownerService from '../api/service';
import type { OwnerTimelineResponse } from '../api/types';
import { OwnerTimeline } from './owner-timeline';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();

  return {
    ...actual,
    useQuery: vi.fn()
  };
});

const useQueryMock = vi.mocked(useQuery);

const property = {
  addressLine: 'Av. Siempre Viva 123',
  city: 'Córdoba',
  province: 'Córdoba'
};

const timelineResponse: OwnerTimelineResponse = {
  engagement: {
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
  },
  items: [
    {
      id: 'movement-1',
      propertyEngagementId: 'engagement-1',
      type: 'STATUS_CHANGE',
      observation: 'Ingresó una consulta calificada desde el portal inmobiliario.',
      nextStep: 'Coordinar visita con el interesado.',
      previousStatus: 'INQUIRIES_AND_VISITS',
      newStatus: 'OFFER_NEGOTIATION',
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
        whatsappPhone: '+54 9 351 111 2222'
      },
      createdAt: '2026-06-01T12:00:00.000Z'
    }
  ],
  page: 1,
  pageSize: 10,
  total: 1
};

describe('OwnerTimeline', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders a movement WhatsApp contact action with structured context and tracks clicks', async () => {
    const trackingSpy = vi
      .spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick')
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    useQueryMock.mockReturnValue({
      data: timelineResponse,
      isError: false,
      isLoading: false
    } as ReturnType<typeof useQuery>);

    render(<OwnerTimeline engagementId='engagement-1' property={property} />);

    const contactLink = screen.getByRole('link', { name: 'Consultar responsable' });

    expect(contactLink).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/5493511112222?text=')
    );
    expect(contactLink).toHaveAttribute('target', '_blank');
    expect(contactLink).toHaveAttribute('rel', 'noopener noreferrer');

    const href = contactLink.getAttribute('href') ?? '';
    const decodedMessage = decodeURIComponent(new URL(href).searchParams.get('text') ?? '');

    expect(decodedMessage).toContain('Av. Siempre Viva 123, Córdoba, Córdoba');
    expect(decodedMessage).toContain('Tipo: Cambio de estado');
    expect(decodedMessage).toContain('Estado: Negociación');
    expect(decodedMessage).toContain('Fecha: 01/06/2026');
    expect(decodedMessage).not.toContain('Ingresó una consulta calificada');
    expect(decodedMessage).not.toContain('Coordinar visita');
    expect(decodedMessage).not.toContain('movement-1');

    await user.click(contactLink);

    expect(trackingSpy).toHaveBeenCalledWith('engagement-1', 'movement-1');
  });

  it('renders unavailable movement contact as a disabled action', () => {
    useQueryMock.mockReturnValue({
      data: {
        ...timelineResponse,
        items: [
          {
            ...timelineResponse.items[0],
            contact: {
              available: false,
              targetType: 'assigned_seller',
              displayLabel: 'Contacto no configurado'
            }
          }
        ]
      },
      isError: false,
      isLoading: false
    } as ReturnType<typeof useQuery>);

    render(<OwnerTimeline engagementId='engagement-1' property={property} />);

    expect(screen.getByRole('button', { name: 'Contacto no configurado' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Consultar responsable' })).not.toBeInTheDocument();
  });

  it('renders the movement contact button as disabled and does not wire the tracking call site (sentinel)', async () => {
    const user = userEvent.setup();
    const trackingSpy = vi
      .spyOn(ownerService, 'trackOwnerMovementWhatsappContactClick')
      .mockResolvedValue(undefined);
    useQueryMock.mockReturnValue({
      data: {
        ...timelineResponse,
        items: [
          {
            ...timelineResponse.items[0],
            contact: {
              available: false,
              targetType: 'assigned_seller',
              displayLabel: 'Contacto no configurado'
            }
          }
        ]
      },
      isError: false,
      isLoading: false
    } as ReturnType<typeof useQuery>);

    render(<OwnerTimeline engagementId='engagement-1' property={property} />);

    const contactButton = screen.getByRole('button', { name: 'Contacto no configurado' });

    expect(contactButton).toBeDisabled();
    // Act step: attempt to click the disabled button. The disabled attribute should
    // swallow the click in jsdom AND the onClick should not be wired to the tracking
    // call site when movement contact.available is false. If anyone removes the
    // disabled attribute OR wires onClick to the disabled state, this sentinel fails.
    await user.click(contactButton);
    expect(trackingSpy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 24.6c — highlightMovementId scroll/highlight + section fallback (S-F1..S-F8)
// ---------------------------------------------------------------------------
// Written BEFORE implementation (TDD RED phase).
// ---------------------------------------------------------------------------

// Shared helper to build a resolved query state with specified items.
function makeResolvedQueryReturn(items: OwnerTimelineResponse['items'] = []): ReturnType<typeof useQuery> {
  return {
    data: { ...timelineResponse, items },
    isError: false,
    isLoading: false,
    isSuccess: true
  } as ReturnType<typeof useQuery>;
}

function makeLoadingQueryReturn(): ReturnType<typeof useQuery> {
  return {
    data: undefined,
    isError: false,
    isLoading: true,
    isSuccess: false
  } as ReturnType<typeof useQuery>;
}

// Extract the engagementId from the timeline query options. The timeline query key
// is ['owner', 'engagements', engagementId, 'timeline', filters], so the engagementId
// lives at index 2. Keying mock responses off this argument (instead of call order)
// keeps tests resilient to re-renders and extra useQuery invocations.
function getEngagementIdFromQueryOptions(options: unknown): string | undefined {
  const queryKey = (options as { queryKey?: unknown[] } | undefined)?.queryKey;
  return typeof queryKey?.[2] === 'string' ? queryKey[2] : undefined;
}

const movement1 = timelineResponse.items[0]!; // id = 'movement-1'
const movement2 = {
  ...movement1,
  id: 'movement-2',
  propertyEngagementId: 'engagement-2'
};

describe('OwnerTimeline — 24.6c highlight/scroll (S-F1..S-F8)', () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    vi.restoreAllMocks();
    // Mock scrollIntoView globally — jsdom does not implement it.
    Element.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // S-F6 — data-movement-id attribute present on every rendered item
  it('S-F6: every rendered timeline item has data-movement-id={movement.id}', async () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));

    render(<OwnerTimeline engagementId='engagement-1' property={property} />);

    // The card root (or its containing element) should carry data-movement-id.
    const el = document.querySelector('[data-movement-id="movement-1"]');
    expect(el).not.toBeNull();
  });

  // S-F1 — hit path: scrollIntoView + ring-2 ring-primary applied then cleared
  it('S-F1: scrolls to and highlights matching movement, clears after 2s', async () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));

    render(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId='movement-1'
      />
    );

    // scrollIntoView on the matching element should have been called.
    await act(async () => {});
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    // ring-2 ring-primary should be present on the highlighted element.
    const highlighted = document.querySelector('[data-movement-id="movement-1"]');
    expect(highlighted?.className).toMatch(/ring-2/);

    // After 2000ms the ring should be cleared.
    act(() => {
      vi.advanceTimersByTime(2001);
    });
    expect(highlighted?.className).not.toMatch(/ring-2/);
  });

  // S-F2 — miss path: section scrollIntoView fires (containerRef), no ring
  it('S-F2: scrolls timeline section into view when movement not in items (no ring)', async () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));

    render(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId='mov-old-not-found'
      />
    );

    await act(async () => {});
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    // Section fallback fires on containerRef.
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    // No ring on any element.
    expect(document.querySelector('.ring-2')).toBeNull();
  });

  // FIX-1 — multi-engagement miss-path isolation: with scrollSectionOnMiss=false the
  // non-matching timeline must NOT section-scroll, so it cannot fight the owning
  // timeline's hit-path scroll and push the highlighted movement off-screen.
  it('FIX-1: does NOT section-scroll on miss when scrollSectionOnMiss is false', async () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));

    render(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId='mov-old-not-found'
        scrollSectionOnMiss={false}
      />
    );

    await act(async () => {});
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.querySelector('.ring-2')).toBeNull();
  });

  // FIX-1 — default behavior preserved: scrollSectionOnMiss defaults to true, so the
  // single-engagement section fallback still fires on a miss.
  it('FIX-1: section-scrolls on miss by default (scrollSectionOnMiss defaults to true)', async () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));

    render(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId='mov-old-not-found'
      />
    );

    await act(async () => {});
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.ring-2')).toBeNull();
  });

  // S-F3 — absent id: no scroll, no highlight, no throw
  it('S-F3: no scroll and no highlight when highlightMovementId is null', async () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));

    render(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId={null}
      />
    );

    await act(async () => {});
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(document.querySelector('.ring-2')).toBeNull();
  });

  // S-F4 — query still loading: no scroll on mount, fires on resolve
  it('S-F4: scroll fires after query resolves, not while loading', async () => {
    // First render in loading state.
    useQueryMock.mockReturnValue(makeLoadingQueryReturn());

    const { rerender } = render(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId='movement-1'
      />
    );

    await act(async () => {});
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scrollSpy).not.toHaveBeenCalled();

    // Simulate query resolving.
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([movement1]));
    rerender(
      <OwnerTimeline
        engagementId='engagement-1'
        property={property}
        highlightMovementId='movement-1'
      />
    );

    await act(async () => {});
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  // S-F7 — two-engagement isolation: only the matching timeline highlights (D4 PROOF)
  it('S-F7: only the matching engagement timeline highlights; sibling is inert', async () => {
    // engagement-1 has movement-1; engagement-2 has movement-2.
    // We look for movement-1, so only engagement-1's timeline should highlight.
    // Key the mock off the engagementId encoded in the query options so the test
    // survives re-renders / extra useQuery calls (does not rely on call order).
    useQueryMock.mockImplementation((options) => {
      const engagementId = getEngagementIdFromQueryOptions(options);
      if (engagementId === 'engagement-2') {
        return makeResolvedQueryReturn([movement2]);
      }
      return makeResolvedQueryReturn([movement1]);
    });

    render(
      <div>
        <OwnerTimeline
          engagementId='engagement-1'
          property={property}
          highlightMovementId='movement-1'
        />
        <OwnerTimeline
          engagementId='engagement-2'
          property={property}
          highlightMovementId='movement-1'
        />
      </div>
    );

    await act(async () => {});

    // movement-1 element (inside engagement-1's containerRef) should have ring.
    const mov1El = document.querySelector('[data-movement-id="movement-1"]');
    expect(mov1El).not.toBeNull();
    expect(mov1El?.className).toMatch(/ring-2/);

    // movement-2 element (engagement-2's) should NOT have ring.
    const mov2El = document.querySelector('[data-movement-id="movement-2"]');
    expect(mov2El).not.toBeNull();
    expect(mov2El?.className).not.toMatch(/ring-2/);
  });

  // S-F8 — pageSize = 25
  it('S-F8: timeline query is called with pageSize 25', () => {
    useQueryMock.mockReturnValue(makeResolvedQueryReturn([]));

    render(<OwnerTimeline engagementId='engagement-1' property={property} />);

    // useQuery is called with the options that include pageSize 25.
    const callArg = useQueryMock.mock.calls[0]?.[0] as { queryKey?: unknown[] } | undefined;
    // The query key should encode pageSize 25 (checked via the ownerEngagementTimelineOptions call).
    // We verify indirectly by checking the queryKey contains 25.
    const queryKeyStr = JSON.stringify(callArg?.queryKey);
    expect(queryKeyStr).toContain('25');
  });
});
