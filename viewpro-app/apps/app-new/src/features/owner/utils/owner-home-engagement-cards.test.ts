import { describe, expect, it } from 'vitest';
import type { OwnerEngagement, OwnerMovement, OwnerProperty } from '../api/types';
import {
  buildOwnerHomeEngagementCards as buildOwnerHomeEngagementCardsFromRecentMovements,
  filterOwnerHomeEngagementCardsByAgency,
  OWNER_HOME_RECENT_MOVEMENT_LIMIT
} from './owner-home-engagement-cards';

function buildOwnerHomeEngagementCards(input: {
  properties: OwnerProperty[];
  engagementsByProperty: Array<OwnerEngagement[] | undefined>;
  latestMovementByEngagementId?: Record<string, OwnerMovement | null | undefined>;
  recentMovementsByEngagementId?: Record<string, OwnerMovement[] | null | undefined>;
}) {
  const recentMovementsByEngagementId =
    input.recentMovementsByEngagementId ??
    Object.fromEntries(
      Object.entries(input.latestMovementByEngagementId ?? {}).map(([engagementId, movement]) => [
        engagementId,
        movement ? [{ ...movement, propertyEngagementId: engagementId }] : []
      ])
    );

  return buildOwnerHomeEngagementCardsFromRecentMovements({
    ...input,
    recentMovementsByEngagementId
  });
}

describe('buildOwnerHomeEngagementCards', () => {
  it('renders one card per engagement when a property is worked by multiple agencies', () => {
    const property = buildProperty({ id: 'property-1' });

    const cards = buildOwnerHomeEngagementCards({
      properties: [property],
      engagementsByProperty: [
        [
          buildEngagement({ id: 'engagement-a', tenantId: 'tenant-a', tenantName: 'Agencia A' }),
          buildEngagement({ id: 'engagement-b', tenantId: 'tenant-b', tenantName: 'Agencia B' })
        ]
      ],
      latestMovementByEngagementId: {}
    });

    expect(cards).toHaveLength(2);
    expect(cards.map((card) => card.id)).toEqual(['engagement-a', 'engagement-b']);
    expect(cards.map((card) => card.agency.name)).toEqual(['Agencia A', 'Agencia B']);
    expect(cards.every((card) => card.property.id === 'property-1')).toBe(true);
  });

  it('selects stage, activity and next action only from the card own engagement', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' })],
      engagementsByProperty: [
        [
          buildEngagement({
            id: 'engagement-a',
            status: 'OFFER_NEGOTIATION',
            tenantId: 'tenant-a',
            tenantName: 'Agencia A'
          }),
          buildEngagement({
            id: 'engagement-b',
            status: 'CAPTURE',
            tenantId: 'tenant-b',
            tenantName: 'Agencia B'
          })
        ]
      ],
      latestMovementByEngagementId: {
        'engagement-a': buildMovement({
          createdAt: '2026-08-20T10:00:00.000Z',
          nextStep: 'Coordinar firma de reserva',
          observation: 'Recibimos una oferta formal'
        })
      }
    });

    const [firstCard, secondCard] = cards;

    expect(firstCard?.engagement.status).toBe('OFFER_NEGOTIATION');
    expect(firstCard?.latestMovement?.observation).toBe('Recibimos una oferta formal');
    expect(firstCard?.nextAction).toBe('Coordinar firma de reserva');
    expect(secondCard?.engagement.status).toBe('CAPTURE');
    expect(secondCard?.latestMovement).toBeNull();
    expect(secondCard?.nextAction).toBeNull();
  });

  it('orders cards by latest movement date descending', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' }), buildProperty({ id: 'property-2' })],
      engagementsByProperty: [
        [buildEngagement({ id: 'engagement-old', tenantId: 'tenant-a' })],
        [buildEngagement({ id: 'engagement-new', tenantId: 'tenant-b' })]
      ],
      latestMovementByEngagementId: {
        'engagement-new': buildMovement({ createdAt: '2026-08-22T09:00:00.000Z' }),
        'engagement-old': buildMovement({ createdAt: '2026-07-01T09:00:00.000Z' })
      }
    });

    expect(cards.map((card) => card.id)).toEqual(['engagement-new', 'engagement-old']);
  });

  it('places engagements without movements after every engagement that has one', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' })],
      engagementsByProperty: [
        [
          buildEngagement({ id: 'engagement-silent-b', tenantId: 'tenant-b' }),
          buildEngagement({ id: 'engagement-silent-a', tenantId: 'tenant-c' }),
          buildEngagement({ id: 'engagement-active', tenantId: 'tenant-a' })
        ]
      ],
      latestMovementByEngagementId: {
        'engagement-active': buildMovement({ createdAt: '2026-06-01T09:00:00.000Z' })
      }
    });

    expect(cards.map((card) => card.id)).toEqual([
      'engagement-active',
      'engagement-silent-a',
      'engagement-silent-b'
    ]);
  });

  it('breaks ties on equal movement dates with the ascending engagement id', () => {
    const sameTimestamp = '2026-08-18T12:00:00.000Z';
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' })],
      engagementsByProperty: [
        [
          buildEngagement({ id: 'engagement-z', tenantId: 'tenant-z' }),
          buildEngagement({ id: 'engagement-a', tenantId: 'tenant-a' })
        ]
      ],
      latestMovementByEngagementId: {
        'engagement-a': buildMovement({ createdAt: sameTimestamp }),
        'engagement-z': buildMovement({ createdAt: sameTimestamp })
      }
    });

    expect(cards.map((card) => card.id)).toEqual(['engagement-a', 'engagement-z']);
  });

  it('does not depend on the arrival order of properties or engagements', () => {
    const propertyOne = buildProperty({ id: 'property-1' });
    const propertyTwo = buildProperty({ id: 'property-2' });
    const engagementOne = buildEngagement({ id: 'engagement-1', tenantId: 'tenant-a' });
    const engagementTwo = buildEngagement({ id: 'engagement-2', tenantId: 'tenant-b' });
    const latestMovementByEngagementId = {
      'engagement-1': buildMovement({ createdAt: '2026-08-01T09:00:00.000Z' }),
      'engagement-2': buildMovement({ createdAt: '2026-08-10T09:00:00.000Z' })
    };

    const forwardOrder = buildOwnerHomeEngagementCards({
      properties: [propertyOne, propertyTwo],
      engagementsByProperty: [[engagementOne], [engagementTwo]],
      latestMovementByEngagementId
    });
    const reversedOrder = buildOwnerHomeEngagementCards({
      properties: [propertyTwo, propertyOne],
      engagementsByProperty: [[engagementTwo], [engagementOne]],
      latestMovementByEngagementId
    });

    expect(forwardOrder.map((card) => card.id)).toEqual(['engagement-2', 'engagement-1']);
    expect(reversedOrder.map((card) => card.id)).toEqual(forwardOrder.map((card) => card.id));
  });

  it('treats an unparsable movement date as missing activity', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' })],
      engagementsByProperty: [
        [
          buildEngagement({ id: 'engagement-broken', tenantId: 'tenant-a' }),
          buildEngagement({ id: 'engagement-valid', tenantId: 'tenant-b' })
        ]
      ],
      latestMovementByEngagementId: {
        'engagement-broken': buildMovement({ createdAt: 'not-a-date' }),
        'engagement-valid': buildMovement({ createdAt: '2026-01-01T09:00:00.000Z' })
      }
    });

    expect(cards.map((card) => card.id)).toEqual(['engagement-valid', 'engagement-broken']);
  });

  it('ignores an empty next step so the card can state that no next action exists', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' })],
      engagementsByProperty: [[buildEngagement({ id: 'engagement-a', tenantId: 'tenant-a' })]],
      latestMovementByEngagementId: {
        'engagement-a': buildMovement({ createdAt: '2026-08-20T10:00:00.000Z', nextStep: '   ' })
      }
    });

    expect(cards[0]?.nextAction).toBeNull();
  });

  it('normalizes the bounded rows before deriving each compact activity summary', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' })],
      engagementsByProperty: [[buildEngagement({ id: 'engagement-a', tenantId: 'tenant-a' })]],
      recentMovementsByEngagementId: {
        'engagement-a': [
          buildMovement({ id: 'movement-four', createdAt: '2026-08-20T10:00:00.000Z' }),
          buildMovement({
            id: 'movement-mismatch',
            propertyEngagementId: 'engagement-sibling',
            createdAt: '2026-08-20T13:00:00.000Z'
          }),
          buildMovement({ id: 'movement-invalid', createdAt: 'not-a-date' }),
          buildMovement({ id: 'movement-tie-z', createdAt: '2026-08-20T11:00:00.000Z' }),
          buildMovement({
            id: 'movement-tie-a',
            createdAt: '2026-08-20T11:00:00.000Z',
            nextStep: '  Llamar al propietario  '
          }),
          buildMovement({ id: 'movement-out-of-bound', createdAt: '2026-08-20T15:00:00.000Z' })
        ]
      }
    } as never);

    expect(OWNER_HOME_RECENT_MOVEMENT_LIMIT).toBe(5);
    expect(cards[0]?.recentMovements.map((movement) => movement.id)).toEqual([
      'movement-tie-a',
      'movement-tie-z',
      'movement-four'
    ]);
    expect(cards[0]?.latestMovement?.id).toBe('movement-tie-a');
    expect(cards[0]?.nextAction).toBe('Llamar al propietario');
  });

  it('keeps mixed-validity movement arrays isolated and card order independent of input order', () => {
    const property = buildProperty({ id: 'property-shared' });
    const engagementA = buildEngagement({ id: 'engagement-a', tenantId: 'tenant-a' });
    const engagementB = buildEngagement({ id: 'engagement-b', tenantId: 'tenant-b' });
    const recentMovementsByEngagementId = {
      'engagement-a': [
        buildMovement({
          id: 'movement-unknown',
          type: 'FUTURE_OWNER_MOVEMENT',
          createdAt: '2026-08-22T10:00:00.000Z'
        })
      ],
      'engagement-b': [
        buildMovement({
          id: 'movement-borrowed',
          propertyEngagementId: 'engagement-a',
          createdAt: '2026-08-23T10:00:00.000Z'
        })
      ]
    };

    const forwardCards = buildOwnerHomeEngagementCards({
      properties: [property],
      engagementsByProperty: [[engagementB, engagementA]],
      recentMovementsByEngagementId
    } as never);
    const reversedCards = buildOwnerHomeEngagementCards({
      properties: [property],
      engagementsByProperty: [[engagementA, engagementB]],
      recentMovementsByEngagementId
    } as never);

    expect(forwardCards.map((card) => card.id)).toEqual(['engagement-a', 'engagement-b']);
    expect(reversedCards.map((card) => card.id)).toEqual(['engagement-a', 'engagement-b']);
    expect(forwardCards[0]?.recentMovements[0]?.type).toBe('FUTURE_OWNER_MOVEMENT');
    expect(forwardCards[1]?.recentMovements).toEqual([]);
  });

  it('skips properties whose engagements have not resolved yet', () => {
    const cards = buildOwnerHomeEngagementCards({
      properties: [buildProperty({ id: 'property-1' }), buildProperty({ id: 'property-2' })],
      engagementsByProperty: [undefined, [buildEngagement({ id: 'engagement-b', tenantId: 'b' })]],
      latestMovementByEngagementId: {}
    });

    expect(cards.map((card) => card.id)).toEqual(['engagement-b']);
  });
});

describe('filterOwnerHomeEngagementCardsByAgency', () => {
  const cards = buildOwnerHomeEngagementCards({
    properties: [buildProperty({ id: 'property-1' })],
    engagementsByProperty: [
      [
        buildEngagement({ id: 'engagement-a', tenantId: 'tenant-a' }),
        buildEngagement({ id: 'engagement-b', tenantId: 'tenant-b' })
      ]
    ],
    latestMovementByEngagementId: {}
  });

  it('keeps every engagement when no agency is selected', () => {
    expect(filterOwnerHomeEngagementCardsByAgency(cards, null)).toHaveLength(2);
  });

  it('keeps only the selected agency engagements', () => {
    const filtered = filterOwnerHomeEngagementCardsByAgency(cards, 'tenant-b');

    expect(filtered.map((card) => card.id)).toEqual(['engagement-b']);
  });
});

function buildProperty(input: { id: string }): OwnerProperty {
  return {
    id: input.id,
    title: `Propiedad ${input.id}`,
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

function buildEngagement(input: {
  id: string;
  status?: string;
  tenantId: string;
  tenantName?: string;
}): OwnerEngagement {
  return {
    id: input.id,
    tenant: { id: input.tenantId, name: input.tenantName ?? `Inmobiliaria ${input.tenantId}` },
    contact: {
      available: true,
      targetType: 'tenant',
      displayLabel: 'Contactar inmobiliaria',
      whatsappPhone: '+5493510000000'
    },
    operationType: 'SALE',
    status: input.status ?? 'ACTIVE_PUBLICATION',
    publishedPriceCents: 100_000_000,
    currency: 'ARS',
    agents: [],
    createdAt: '2026-05-01T10:00:00.000Z',
    updatedAt: '2026-05-20T10:00:00.000Z'
  };
}

function buildMovement(input: {
  createdAt: string;
  id?: string;
  nextStep?: string | null;
  observation?: string;
  propertyEngagementId?: string;
  type?: string;
}): OwnerMovement {
  return {
    id: input.id ?? `movement-${input.createdAt}`,
    propertyEngagementId: input.propertyEngagementId ?? 'engagement-a',
    type: input.type ?? 'STATUS_CHANGE',
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
