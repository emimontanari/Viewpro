import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
