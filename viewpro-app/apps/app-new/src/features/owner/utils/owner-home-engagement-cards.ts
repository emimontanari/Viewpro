import type { OwnerEngagement, OwnerMovement, OwnerProperty } from '../api/types';

export const OWNER_HOME_RECENT_MOVEMENT_LIMIT = 5;

export type OwnerHomeEngagementCard = {
  id: string;
  agency: { id: string; name: string };
  engagement: OwnerEngagement;
  latestMovement: OwnerMovement | null;
  latestMovementAt: number | null;
  nextAction: string | null;
  property: OwnerProperty;
  recentMovements: OwnerMovement[];
};

/**
 * Builds one card per owner-visible agency/property engagement. Every card reads its
 * stage, activity, and next action exclusively from its own normalized movement rows.
 */
export function buildOwnerHomeEngagementCards({
  properties,
  engagementsByProperty,
  recentMovementsByEngagementId
}: {
  properties: OwnerProperty[];
  engagementsByProperty: Array<OwnerEngagement[] | undefined>;
  recentMovementsByEngagementId: Record<string, OwnerMovement[] | null | undefined>;
}): OwnerHomeEngagementCard[] {
  const cards = properties.flatMap((property, index) =>
    (engagementsByProperty[index] ?? []).map((engagement) =>
      buildCard({
        engagement,
        movements: recentMovementsByEngagementId[engagement.id],
        property
      })
    )
  );

  return cards.toSorted(compareOwnerHomeEngagementCards);
}

function buildCard({
  engagement,
  movements,
  property
}: {
  engagement: OwnerEngagement;
  movements: OwnerMovement[] | null | undefined;
  property: OwnerProperty;
}): OwnerHomeEngagementCard {
  const recentMovements = normalizeRecentMovements(engagement.id, movements);
  const latestMovement = recentMovements[0] ?? null;

  return {
    id: engagement.id,
    agency: engagement.tenant,
    engagement,
    latestMovement,
    latestMovementAt: latestMovement ? parseMovementDate(latestMovement.createdAt) : null,
    nextAction: getNextAction(latestMovement),
    property,
    recentMovements
  };
}

function normalizeRecentMovements(
  engagementId: string,
  movements: OwnerMovement[] | null | undefined
) {
  return (movements ?? [])
    .slice(0, OWNER_HOME_RECENT_MOVEMENT_LIMIT)
    .map((movement) => ({ movement, timestamp: parseMovementDate(movement.createdAt) }))
    .filter(
      (candidate): candidate is { movement: OwnerMovement; timestamp: number } =>
        candidate.movement.propertyEngagementId === engagementId && candidate.timestamp !== null
    )
    .toSorted(
      (first, second) =>
        second.timestamp - first.timestamp || first.movement.id.localeCompare(second.movement.id)
    )
    .map(({ movement }) => movement);
}

function compareOwnerHomeEngagementCards(
  firstCard: OwnerHomeEngagementCard,
  secondCard: OwnerHomeEngagementCard
) {
  if (firstCard.latestMovementAt !== null && secondCard.latestMovementAt !== null) {
    return (
      secondCard.latestMovementAt - firstCard.latestMovementAt ||
      compareEngagementId(firstCard, secondCard)
    );
  }

  if (firstCard.latestMovementAt !== null) {
    return -1;
  }

  if (secondCard.latestMovementAt !== null) {
    return 1;
  }

  return compareEngagementId(firstCard, secondCard);
}

function compareEngagementId(firstCard: OwnerHomeEngagementCard, secondCard: OwnerHomeEngagementCard) {
  return firstCard.id < secondCard.id ? -1 : firstCard.id > secondCard.id ? 1 : 0;
}

function parseMovementDate(value: string) {
  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function getNextAction(movement: OwnerMovement | null) {
  const nextStep = movement?.nextStep?.trim();

  return nextStep ? nextStep : null;
}

/**
 * Narrows the cards to a single agency. A null agency id means every agency, so the
 * owner sees each of their engagements unless they explicitly ask for one agency.
 */
export function filterOwnerHomeEngagementCardsByAgency(
  cards: OwnerHomeEngagementCard[],
  agencyId: string | null
) {
  return agencyId === null ? cards : cards.filter((card) => card.agency.id === agencyId);
}
