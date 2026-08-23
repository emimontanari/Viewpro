'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import type { PropertyEngagementStatus } from '@/features/products/api/types';
import { getStatusTone as getDashboardStatusTone } from '@/features/products/components/product-tables/columns';
import { propertyStatusOptions } from '@/features/products/constants/product-options';
import { cn } from '@/lib/utils';
import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ownerEngagementLatestMovementOptions,
  ownerPropertiesOptions,
  ownerPropertyEngagementsOptions
} from '../api/queries';
import { trackOwnerWhatsappContactClick } from '../api/service';
import type { OwnerEngagement, OwnerMovement, OwnerProperty } from '../api/types';
import {
  buildOwnerHomeEngagementCards,
  filterOwnerHomeEngagementCardsByAgency,
  type OwnerHomeEngagementCard
} from '../utils/owner-home-engagement-cards';
import { buildOwnerPropertyWhatsappHref } from '../utils/owner-whatsapp-contact';

type OwnerAgency = {
  id: string;
  name: string;
};

type OwnerStatusSummaryViewModel = {
  label: string;
  progress: number;
  progressTone: string;
  tone: string;
};

const ALL_AGENCIES_VALUE = 'all';
const EMPTY_OWNER_PROPERTIES: OwnerProperty[] = [];

export function OwnerHome() {
  const propertiesQuery = useQuery(ownerPropertiesOptions());
  const properties = propertiesQuery.data ?? EMPTY_OWNER_PROPERTIES;
  const engagementQueries = useQueries({
    queries: properties.map((property) => ownerPropertyEngagementsOptions(property.id))
  });
  const visibleEngagements = React.useMemo(
    () => engagementQueries.flatMap((query) => query.data ?? []),
    [engagementQueries]
  );
  const movementQueries = useQueries({
    queries: visibleEngagements.map((engagement) =>
      ownerEngagementLatestMovementOptions(engagement.id)
    )
  });
  const latestMovementByEngagementId = React.useMemo(
    () =>
      buildLatestMovementIndex(
        visibleEngagements,
        movementQueries.map((query) => query.data)
      ),
    [movementQueries, visibleEngagements]
  );
  const unreadableActivityEngagementIds = React.useMemo(
    () =>
      new Set(
        visibleEngagements
          .filter((_engagement, index) => movementQueries[index]?.isError)
          .map((engagement) => engagement.id)
      ),
    [movementQueries, visibleEngagements]
  );
  const cards = React.useMemo(
    () =>
      buildOwnerHomeEngagementCards({
        properties,
        engagementsByProperty: engagementQueries.map((query) => query.data),
        latestMovementByEngagementId
      }),
    [engagementQueries, latestMovementByEngagementId, properties]
  );
  const agencies = React.useMemo(() => getOwnerAgencies(cards), [cards]);
  const hasMultipleAgencies = agencies.length > 1;
  const [selectedAgencyId, setSelectedAgencyId] = React.useState<string | null>(null);

  if (
    propertiesQuery.isLoading ||
    engagementQueries.some((query) => query.isLoading) ||
    movementQueries.some((query) => query.isLoading)
  ) {
    return <OwnerHomeSkeleton />;
  }

  if (propertiesQuery.isError) {
    return (
      <OwnerFallbackState
        title='No pudimos cargar tus propiedades'
        description='Intentá actualizar la página. Si el problema continúa, contactá a tu inmobiliaria.'
      />
    );
  }

  if (engagementQueries.some((query) => query.isError)) {
    return (
      <OwnerFallbackState
        title='No pudimos cargar tus inmobiliarias'
        description='Intentá actualizar la página para ver las propiedades que tenés vinculadas con cada inmobiliaria.'
      />
    );
  }

  const effectiveSelectedAgencyId = getEffectiveSelectedAgencyId({ agencies, selectedAgencyId });
  const visibleCards = filterOwnerHomeEngagementCardsByAgency(cards, effectiveSelectedAgencyId);
  const singleAgency = hasMultipleAgencies ? null : (agencies[0] ?? null);

  return (
    <div className='space-y-6'>
      <OwnerHeroSummary />

      {hasMultipleAgencies ? (
        <OwnerAgencySelector
          agencies={agencies}
          selectedAgencyId={effectiveSelectedAgencyId ?? ALL_AGENCIES_VALUE}
          onSelectedAgencyChange={setSelectedAgencyId}
        />
      ) : null}

      {visibleCards.length > 0 ? (
        <section className='grid gap-4'>
          {visibleCards.map((card) => (
            <OwnerEngagementSummaryCard
              key={card.id}
              card={card}
              hasUnreadableActivity={unreadableActivityEngagementIds.has(card.id)}
            />
          ))}
        </section>
      ) : (
        <OwnerFallbackState
          title='Todavía no tenés propiedades activas'
          description='Cuando tu inmobiliaria te vincule a una propiedad, vas a poder ver su seguimiento desde este portal.'
        />
      )}

      {singleAgency ? (
        <OwnerAgencySummary agency={singleAgency} propertyCount={visibleCards.length} />
      ) : null}
    </div>
  );
}

function OwnerHeroSummary() {
  return (
    <section className='space-y-3'>
      <Badge variant='secondary'>Portal propietario</Badge>
      <div className='space-y-2'>
        <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>Tus propiedades</h1>
        <p className='max-w-2xl text-muted-foreground'>
          Seguimiento claro de las gestiones activas que tu inmobiliaria está trabajando.
        </p>
      </div>
    </section>
  );
}

function OwnerAgencySummary({
  agency,
  propertyCount
}: {
  agency: OwnerAgency;
  propertyCount: number;
}) {
  const initials = getAgencyInitials(agency.name);

  return (
    <Card className='relative overflow-hidden py-0'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 dark:from-primary/10 dark:to-purple-500/10'
      />
      <CardContent className='relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-center gap-4'>
          <span
            aria-hidden='true'
            className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-base font-semibold tracking-wide text-white shadow-sm ring-1 ring-white/10'
          >
            {initials}
          </span>
          <div className='min-w-0 space-y-1.5'>
            <p className='text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase'>
              Inmobiliaria vinculada
            </p>
            <div className='flex items-start gap-2'>
              <h2
                className='line-clamp-2 text-base leading-tight font-semibold tracking-tight'
                title={agency.name}
              >
                {agency.name}
              </h2>
              <Icons.badgeCheck
                className='mt-0.5 size-3.5 shrink-0 text-emerald-700 dark:text-emerald-300'
                aria-label='Inmobiliaria verificada'
              />
            </div>
            <p className='text-[13.5px] text-muted-foreground'>
              Gestionando {formatPropertyCount(propertyCount)} para vos.
            </p>
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-2 self-start text-[12.5px] font-medium text-emerald-700 sm:self-auto dark:text-emerald-300'>
          <span aria-hidden='true' className='size-1.5 rounded-full bg-emerald-500' />
          Acceso vigente
        </div>
      </CardContent>
    </Card>
  );
}

function getAgencyInitials(name: string) {
  const trimmed = name.trim();

  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/);

  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }

  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

function OwnerAgencySelector({
  agencies,
  selectedAgencyId,
  onSelectedAgencyChange
}: {
  agencies: OwnerAgency[];
  selectedAgencyId: string;
  onSelectedAgencyChange: (agencyId: string | null) => void;
}) {
  return (
    <Card className='py-0'>
      <CardContent className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='space-y-1'>
          <h2 className='font-semibold'>Seleccioná inmobiliaria</h2>
          <p className='text-sm text-muted-foreground'>
            Tenés propiedades vinculadas con más de una inmobiliaria.
          </p>
        </div>
        <div className='sm:w-72'>
          <Select
            value={selectedAgencyId}
            onValueChange={(nextValue) =>
              onSelectedAgencyChange(nextValue === ALL_AGENCIES_VALUE ? null : nextValue)
            }
          >
            <SelectTrigger aria-label='Inmobiliaria' className='w-full'>
              <SelectValue placeholder='Todas las inmobiliarias' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_AGENCIES_VALUE}>Todas las inmobiliarias</SelectItem>
              {agencies.map((agency) => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function OwnerEngagementSummaryCard({
  card,
  hasUnreadableActivity
}: {
  card: OwnerHomeEngagementCard;
  hasUnreadableActivity: boolean;
}) {
  const { agency, engagement, property } = card;
  const primaryImage = property.primaryImage ?? property.images[0] ?? null;
  const statusSummary = getOwnerStatusSummary(engagement.status);
  const contactHref = buildOwnerPropertyWhatsappHref({ contact: engagement.contact, property });
  const isContactConfigured = Boolean(contactHref);
  const contactLabel = isContactConfigured
    ? (engagement.contact.displayLabel ?? 'Contactar inmobiliaria')
    : 'Contacto';
  const propertyLocation = formatPropertyLocation(property);
  const displayTitle = formatOwnerPropertyTitle(property);
  const detailHref = buildOwnerEngagementDetailHref(card);
  const handleContactClick = React.useCallback(() => {
    if (!contactHref) {
      return;
    }

    void trackOwnerWhatsappContactClick(engagement.id).catch(() => undefined);
  }, [contactHref, engagement.id]);

  return (
    <Card className='overflow-hidden py-0 transition-shadow hover:shadow-md'>
      <CardContent className='p-4 sm:p-5'>
        <div className='grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_260px] lg:items-start'>
          <div className='relative overflow-hidden rounded-2xl bg-muted'>
            {primaryImage ? (
              // oxlint-disable-next-line next/no-img-element -- owner property images come from the authenticated API payload and use the existing local fallback-free card pattern.
              <img
                src={primaryImage.url}
                alt={`Imagen principal de ${property.title}`}
                className='aspect-[16/10] w-full object-cover lg:h-full lg:min-h-[236px] lg:aspect-auto'
              />
            ) : (
              <div className='flex aspect-[16/10] w-full items-center justify-center bg-muted lg:h-full lg:min-h-[236px]'>
                <div className='text-center text-muted-foreground'>
                  <Icons.media className='mx-auto size-10' aria-hidden='true' />
                  <p className='mt-2 text-sm font-medium'>Imagen pendiente</p>
                </div>
              </div>
            )}
            {statusSummary ? (
              <Badge
                variant='secondary'
                className='absolute left-3 top-3 gap-1.5 bg-background/90 text-emerald-700 backdrop-blur dark:text-emerald-300'
              >
                <span aria-hidden='true' className='size-1.5 rounded-full bg-emerald-500' />
                {statusSummary.label}
              </Badge>
            ) : null}
            <Badge
              variant='secondary'
              className='absolute right-3 top-3 bg-background/90 backdrop-blur'
            >
              {getPropertyTypeLabel(property.propertyType)}
            </Badge>
          </div>

          <div className='min-w-0'>
            <div className='space-y-2'>
              <h2
                className='line-clamp-2 text-lg leading-tight font-semibold tracking-tight sm:text-xl lg:text-2xl'
                title={property.title}
              >
                {displayTitle}
              </h2>
              <p className='text-sm text-muted-foreground break-words'>{propertyLocation}</p>
              <p className='text-sm font-medium text-muted-foreground'>Gestión con {agency.name}</p>
            </div>

            {statusSummary ? <OwnerStatusSummary status={statusSummary} /> : null}

            <OwnerEngagementActivity card={card} hasUnreadableActivity={hasUnreadableActivity} />
          </div>

          <div className='grid content-start gap-3 lg:border-l lg:pl-5'>
            <Button asChild size='lg' className='w-full'>
              <Link href={detailHref}>
                Abrir propiedad
                <Icons.arrowRight className='ml-2 size-4' aria-hidden='true' />
              </Link>
            </Button>
            <div className='grid grid-cols-3 gap-3 lg:grid-cols-1'>
              <OwnerActionTile
                href={`${detailHref}&tab=tracking`}
                icon={Icons.trendingUp}
                label='Seguimiento'
                ariaLabel='Ver seguimiento'
              />
              <OwnerActionTile
                href={`${detailHref}&tab=documents`}
                icon={Icons.page}
                label='Documentación'
                ariaLabel='Ver documentación'
              />
              <OwnerActionTile
                href={contactHref}
                icon={Icons.chat}
                label={contactLabel}
                ariaLabel={
                  isContactConfigured ? 'Contactar inmobiliaria' : 'Contacto — no configurado'
                }
                showUnavailableIndicator={!isContactConfigured}
                onClick={handleContactClick}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OwnerEngagementActivity({
  card,
  hasUnreadableActivity
}: {
  card: OwnerHomeEngagementCard;
  hasUnreadableActivity: boolean;
}) {
  if (hasUnreadableActivity) {
    return (
      <div className='mt-[18px] space-y-1 rounded-xl border border-dashed p-3'>
        <p className='text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase'>
          Última actividad
        </p>
        <p className='text-sm text-muted-foreground'>
          No pudimos cargar la actividad de esta gestión.
        </p>
      </div>
    );
  }

  return (
    <div className='mt-[18px] grid gap-3 sm:grid-cols-2'>
      <div className='space-y-1 rounded-xl border border-dashed p-3'>
        <p className='text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase'>
          Última actividad
        </p>
        {card.latestMovement ? (
          <>
            <p className='line-clamp-2 text-sm text-foreground'>
              {card.latestMovement.observation}
            </p>
            <p className='text-xs text-muted-foreground'>
              {formatMovementDate(card.latestMovement)}
            </p>
          </>
        ) : (
          <p className='text-sm text-muted-foreground'>Todavía no hay movimientos registrados.</p>
        )}
      </div>
      <div className='space-y-1 rounded-xl border border-dashed p-3'>
        <p className='text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase'>
          Próxima acción
        </p>
        {card.nextAction ? (
          <p className='line-clamp-2 text-sm text-foreground'>{card.nextAction}</p>
        ) : (
          <p className='text-sm text-muted-foreground'>Sin próxima acción informada.</p>
        )}
      </div>
    </div>
  );
}

function OwnerStatusSummary({ status }: { status: OwnerStatusSummaryViewModel }) {
  return (
    <div className='mt-[18px] w-full space-y-2'>
      <div className='flex w-full items-center justify-between gap-3'>
        <span className='text-sm leading-5 text-muted-foreground'>Progreso de gestión</span>
        <span className='text-right text-sm leading-5 font-medium text-foreground'>
          {status.progress}%
        </span>
      </div>
      <Progress
        value={status.progress}
        role='progressbar'
        aria-label={`Progreso según etapa: ${status.label} (${status.progress}%)`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={status.progress}
        className={cn(
          'h-[6px] rounded-none bg-muted [&_[data-slot=progress-indicator]]:rounded-none',
          status.progressTone
        )}
      />
    </div>
  );
}

function OwnerActionTile({
  ariaLabel,
  href,
  icon: Icon,
  label,
  onClick,
  showUnavailableIndicator = false
}: {
  ariaLabel: string;
  href: string | null;
  icon: typeof Icons.product;
  label: string;
  onClick?: () => void;
  showUnavailableIndicator?: boolean;
}) {
  const content = (
    <>
      {showUnavailableIndicator ? (
        <span
          data-testid='owner-contact-unavailable-indicator'
          aria-hidden='true'
          className='absolute right-2 top-2 size-2 rounded-full bg-destructive'
        />
      ) : null}
      <Icon className='size-6 text-muted-foreground' aria-hidden='true' />
      <span className='text-xs leading-tight sm:text-sm'>{label}</span>
    </>
  );

  if (!href) {
    return (
      <Button
        type='button'
        variant='outline'
        disabled
        aria-label={ariaLabel}
        className='relative h-20 w-full flex-col gap-2'
      >
        {content}
      </Button>
    );
  }

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return (
      <Button asChild variant='outline' className='h-20 w-full flex-col gap-2'>
        <a
          href={href}
          aria-label={ariaLabel}
          target='_blank'
          rel='noopener noreferrer'
          onClick={onClick}
        >
          {content}
        </a>
      </Button>
    );
  }

  return (
    <Button asChild variant='outline' className='h-20 w-full flex-col gap-2'>
      <Link href={href} aria-label={ariaLabel}>
        {content}
      </Link>
    </Button>
  );
}

function OwnerHomeSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='h-24 animate-pulse rounded-3xl bg-muted' />
      <div className='h-96 animate-pulse rounded-xl bg-muted' />
      <div className='h-28 animate-pulse rounded-xl bg-muted' />
    </div>
  );
}

function OwnerFallbackState({ title, description }: { title: string; description: string }) {
  return (
    <div className='rounded-2xl border border-dashed bg-background p-8 text-center'>
      <h2 className='text-lg font-semibold'>{title}</h2>
      <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>{description}</p>
    </div>
  );
}

function buildLatestMovementIndex(
  engagements: OwnerEngagement[],
  timelinePages: Array<{ items: OwnerMovement[] } | undefined>
) {
  const latestMovementByEngagementId: Record<string, OwnerMovement | null> = {};

  engagements.forEach((engagement, index) => {
    latestMovementByEngagementId[engagement.id] = timelinePages[index]?.items[0] ?? null;
  });

  return latestMovementByEngagementId;
}

function buildOwnerEngagementDetailHref(card: OwnerHomeEngagementCard) {
  return `/owner/properties/${card.property.id}?engagement=${encodeURIComponent(card.id)}`;
}

function getOwnerAgencies(cards: OwnerHomeEngagementCard[]) {
  const agencies = new Map<string, OwnerAgency>();

  for (const card of cards) {
    agencies.set(card.agency.id, card.agency);
  }

  return [...agencies.values()].toSorted((firstAgency, secondAgency) =>
    firstAgency.name.localeCompare(secondAgency.name, 'es')
  );
}

function getEffectiveSelectedAgencyId({
  agencies,
  selectedAgencyId
}: {
  agencies: OwnerAgency[];
  selectedAgencyId: string | null;
}) {
  return selectedAgencyId && agencies.some((agency) => agency.id === selectedAgencyId)
    ? selectedAgencyId
    : null;
}

function formatMovementDate(movement: OwnerMovement) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(movement.createdAt));
}

function formatPropertyCount(count: number) {
  return count === 1 ? '1 propiedad' : `${count} propiedades`;
}

function formatPropertyLocation(property: OwnerProperty) {
  const locationParts = getPropertyLocationParts(property);

  return locationParts
    .filter((part, index) => index === 0 || !isSameLocationPart(part, locationParts[index - 1]))
    .join(', ');
}

function getPropertyLocationParts(property: OwnerProperty) {
  return [property.addressLine, property.city, property.province]
    .map((part) => part?.trim())
    .filter(Boolean);
}

function formatOwnerPropertyTitle(property: OwnerProperty) {
  const trimmedTitle = property.title.trim();
  const lowerTitle = trimmedTitle.toLocaleLowerCase('es');
  const locationSeparator = ' en ';
  const separatorIndex = lowerTitle.lastIndexOf(locationSeparator);

  if (separatorIndex === -1) {
    return trimmedTitle;
  }

  const titlePrefix = trimmedTitle.slice(0, separatorIndex).trim();
  const trailingLocation = trimmedTitle.slice(separatorIndex + locationSeparator.length).trim();
  const locationParts = getPropertyLocationParts(property);

  if (titlePrefix.length >= 8 && isKnownPropertyLocationPart(trailingLocation, locationParts)) {
    return titlePrefix;
  }

  return trimmedTitle;
}

function isKnownPropertyLocationPart(value: string, locationParts: string[]) {
  const normalizedValue = normalizeLocationPart(value);

  return locationParts.some((part) => normalizeLocationPart(part) === normalizedValue);
}

function isSameLocationPart(left: string, right?: string) {
  return normalizeLocationPart(left) === normalizeLocationPart(right ?? '');
}

function normalizeLocationPart(value: string) {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function getPropertyTypeLabel(propertyType: string) {
  const labels: Record<string, string> = {
    APARTMENT: 'Departamento',
    COMMERCIAL: 'Comercial',
    HOUSE: 'Casa',
    LAND: 'Terreno',
    OTHER: 'Otro'
  };

  return labels[propertyType] ?? propertyType;
}

function getOwnerStatusSummary(status: string): OwnerStatusSummaryViewModel | null {
  if (!isKnownPropertyEngagementStatus(status)) {
    return null;
  }

  return {
    label: getStatusLabel(status),
    progress: getStatusProgress(status),
    progressTone: getStatusProgressTone(status),
    tone: getDashboardStatusTone(status)
  };
}

function getStatusLabel(status: PropertyEngagementStatus) {
  return propertyStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function getStatusProgressTone(status: PropertyEngagementStatus) {
  const tones: Record<PropertyEngagementStatus, string> = {
    CAPTURE: '[&_[data-slot=progress-indicator]]:bg-amber-500',
    DOCUMENTATION_PENDING: '[&_[data-slot=progress-indicator]]:bg-orange-500',
    PUBLICATION_PREPARATION: '[&_[data-slot=progress-indicator]]:bg-sky-500',
    ACTIVE_PUBLICATION: '[&_[data-slot=progress-indicator]]:bg-emerald-500',
    INQUIRIES_AND_VISITS: '[&_[data-slot=progress-indicator]]:bg-blue-500',
    OFFER_NEGOTIATION: '[&_[data-slot=progress-indicator]]:bg-violet-500',
    RESERVATION_STARTED: '[&_[data-slot=progress-indicator]]:bg-fuchsia-500',
    FINAL_DOCUMENTATION: '[&_[data-slot=progress-indicator]]:bg-indigo-500',
    CLOSED: '[&_[data-slot=progress-indicator]]:bg-zinc-500',
    CANCELLED: '[&_[data-slot=progress-indicator]]:bg-red-500'
  };

  return tones[status];
}

function isKnownPropertyEngagementStatus(status: string): status is PropertyEngagementStatus {
  return propertyStatusOptions.some((option) => option.value === status);
}

function getStatusProgress(status: PropertyEngagementStatus) {
  const activeStatusOptions = propertyStatusOptions.filter(
    (option) => option.value !== 'CANCELLED'
  );
  const currentIndex = activeStatusOptions.findIndex((option) => option.value === status);

  if (status === 'CANCELLED') {
    return 100;
  }

  if (currentIndex === -1 || activeStatusOptions.length === 0) {
    return 0;
  }

  return Math.round(((currentIndex + 1) / activeStatusOptions.length) * 100);
}
