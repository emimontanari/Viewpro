import type { OwnerEngagement, OwnerMovement, OwnerProperty } from '../api/types';

export type OwnerHomeEngagementCard = {
  id: string;
  agency: { id: string; name: string };
  engagement: OwnerEngagement;
  latestMovement: OwnerMovement | null;
  latestMovementAt: number | null;
  nextAction: string | null;
  property: OwnerProperty;
};

/**
 * Builds one card per owner-visible agency/property engagement.
 *
 * Every card reads its stage, activity and next action exclusively from its own
 * engagement: a property worked by two agencies produces two independent cards and
 * neither one borrows activity from the other.
 *
 * Cards are ordered by the date of the engagement's latest owner-visible movement,
 * descending; engagements without a movement are placed last; ties are resolved by
 * the stable engagement id, ascending. The order is derived from the card data, so
 * it never depends on the order in which properties, engagements or movements arrive.
 */
export function buildOwnerHomeEngagementCards({
  properties,
  engagementsByProperty,
  latestMovementByEngagementId
}: {
  properties: OwnerProperty[];
  engagementsByProperty: Array<OwnerEngagement[] | undefined>;
  latestMovementByEngagementId: Record<string, OwnerMovement | null | undefined>;
}): OwnerHomeEngagementCard[] {
  const cards = properties.flatMap((property, index) =>
    (engagementsByProperty[index] ?? []).map((engagement) =>
      buildCard({
        engagement,
        latestMovement: latestMovementByEngagementId[engagement.id],
        property
      })
    )
  );

  return cards.toSorted(compareOwnerHomeEngagementCards);
}

function buildCard({
  engagement,
  latestMovement,
  property
}: {
  engagement: OwnerEngagement;
  latestMovement: OwnerMovement | null | undefined;
  property: OwnerProperty;
}): OwnerHomeEngagementCard {
  const latestMovementAt = latestMovement ? parseMovementDate(latestMovement.createdAt) : null;
  // A movement we cannot place in time cannot be presented as recent activity, so the
  // card falls back to its explicit no-activity state instead of rendering an invalid date.
  const visibleMovement = latestMovementAt === null ? null : (latestMovement ?? null);

  return {
    id: engagement.id,
    agency: engagement.tenant,
    engagement,
    latestMovement: visibleMovement,
    latestMovementAt,
    nextAction: getNextAction(visibleMovement),
    property
  };
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

function compareEngagementId(
  firstCard: OwnerHomeEngagementCard,
  secondCard: OwnerHomeEngagementCard
) {
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
