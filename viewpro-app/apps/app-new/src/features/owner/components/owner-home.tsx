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
import { ownerPropertiesOptions, ownerPropertyEngagementsOptions } from '../api/queries';
import { trackOwnerWhatsappContactClick } from '../api/service';
import type { OwnerEngagement, OwnerProperty } from '../api/types';
import { buildOwnerPropertyWhatsappHref } from '../utils/owner-whatsapp-contact';

type OwnerAgency = {
  id: string;
  name: string;
};

type OwnerPropertyWithAgencies = {
  agencies: OwnerAgency[];
  engagements: OwnerEngagement[];
  property: OwnerProperty;
};

type OwnerStatusSummaryViewModel = {
  label: string;
  progress: number;
  progressTone: string;
  tone: string;
};

const EMPTY_OWNER_PROPERTIES: OwnerProperty[] = [];

export function OwnerHome() {
  const propertiesQuery = useQuery(ownerPropertiesOptions());
  const properties = propertiesQuery.data ?? EMPTY_OWNER_PROPERTIES;
  const engagementQueries = useQueries({
    queries: properties.map((property) => ownerPropertyEngagementsOptions(property.id))
  });
  const propertyRecords = React.useMemo(
    () =>
      buildOwnerPropertyAgencyRecords(
        properties,
        engagementQueries.map((query) => query.data)
      ),
    [engagementQueries, properties]
  );
  const agencies = React.useMemo(() => getOwnerAgencies(propertyRecords), [propertyRecords]);
  const hasMultipleAgencies = agencies.length > 1;
  const [selectedAgencyId, setSelectedAgencyId] = React.useState<string | null>(null);

  if (propertiesQuery.isLoading || engagementQueries.some((query) => query.isLoading)) {
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

  const effectiveSelectedAgencyId = getEffectiveSelectedAgencyId({
    agencies,
    hasMultipleAgencies,
    selectedAgencyId
  });
  const visibleRecords = getVisibleOwnerPropertyRecords({
    hasMultipleAgencies,
    propertyRecords,
    selectedAgencyId: effectiveSelectedAgencyId
  });
  const selectedAgency = agencies.find((agency) => agency.id === effectiveSelectedAgencyId) ?? null;
  const currentAgency = selectedAgency ?? (!hasMultipleAgencies ? (agencies[0] ?? null) : null);

  return (
    <div className='space-y-6'>
      <OwnerHeroSummary />

      {hasMultipleAgencies ? (
        <OwnerAgencySelector
          agencies={agencies}
          selectedAgencyId={effectiveSelectedAgencyId ?? agencies[0]?.id ?? ''}
          onSelectedAgencyChange={setSelectedAgencyId}
        />
      ) : null}

      {visibleRecords.length > 0 ? (
        <section className='grid gap-4'>
          {visibleRecords.map((record) => (
            <OwnerPropertyCard key={record.property.id} record={record} />
          ))}
        </section>
      ) : (
        <OwnerFallbackState
          title='Todavía no tenés propiedades activas'
          description='Cuando tu inmobiliaria te vincule a una propiedad, vas a poder ver su seguimiento desde este portal.'
        />
      )}

      {currentAgency ? (
        <OwnerAgencySummary agency={currentAgency} propertyCount={visibleRecords.length} />
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
  onSelectedAgencyChange: (agencyId: string) => void;
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
          <Select value={selectedAgencyId} onValueChange={onSelectedAgencyChange}>
            <SelectTrigger aria-label='Inmobiliaria' className='w-full'>
              <SelectValue placeholder='Elegí una inmobiliaria' />
            </SelectTrigger>
            <SelectContent>
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

function OwnerPropertyCard({ record }: { record: OwnerPropertyWithAgencies }) {
  const property = record.property;
  const engagement = record.engagements[0] ?? null;
  const primaryImage = property.primaryImage ?? property.images[0] ?? null;
  const statusSummary = engagement ? getOwnerStatusSummary(engagement.status) : null;
  const contactHref = engagement
    ? buildOwnerPropertyWhatsappHref({ contact: engagement.contact, property })
    : null;
  const isContactConfigured = Boolean(contactHref);
  const contactLabel = isContactConfigured
    ? (engagement?.contact.displayLabel ?? 'Contactar inmobiliaria')
    : 'Contacto';
  const propertyLocation = formatPropertyLocation(property);
  const displayTitle = formatOwnerPropertyTitle(property);
  const handleContactClick = React.useCallback(() => {
    if (!engagement || !contactHref) {
      return;
    }

    void trackOwnerWhatsappContactClick(engagement.id).catch(() => undefined);
  }, [contactHref, engagement]);

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
            </div>

            {statusSummary ? <OwnerStatusSummary status={statusSummary} /> : null}
          </div>

          <div className='grid content-start gap-3 lg:border-l lg:pl-5'>
            <Button asChild size='lg' className='w-full'>
              <Link href={`/owner/properties/${property.id}`}>
                Abrir propiedad
                <Icons.arrowRight className='ml-2 size-4' aria-hidden='true' />
              </Link>
            </Button>
            <div className='grid grid-cols-3 gap-3 lg:grid-cols-1'>
              <OwnerActionTile
                href={`/owner/properties/${property.id}?tab=tracking`}
                icon={Icons.trendingUp}
                label='Seguimiento'
                ariaLabel='Ver seguimiento'
              />
              <OwnerActionTile
                href={`/owner/properties/${property.id}?tab=documents`}
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

function buildOwnerPropertyAgencyRecords(
  properties: OwnerProperty[],
  engagementsByProperty: Array<OwnerEngagement[] | undefined>
): OwnerPropertyWithAgencies[] {
  return properties.map((property, index) => {
    const engagements = engagementsByProperty[index] ?? [];

    return {
      property,
      engagements,
      agencies: getUniqueAgenciesFromEngagements(engagements)
    };
  });
}

function getOwnerAgencies(propertyRecords: OwnerPropertyWithAgencies[]) {
  return getUniqueAgencies(propertyRecords.flatMap((record) => record.agencies));
}

function getEffectiveSelectedAgencyId({
  agencies,
  hasMultipleAgencies,
  selectedAgencyId
}: {
  agencies: OwnerAgency[];
  hasMultipleAgencies: boolean;
  selectedAgencyId: string | null;
}) {
  if (!hasMultipleAgencies) {
    return null;
  }

  return selectedAgencyId && agencies.some((agency) => agency.id === selectedAgencyId)
    ? selectedAgencyId
    : (agencies[0]?.id ?? null);
}

function getVisibleOwnerPropertyRecords({
  hasMultipleAgencies,
  propertyRecords,
  selectedAgencyId
}: {
  hasMultipleAgencies: boolean;
  propertyRecords: OwnerPropertyWithAgencies[];
  selectedAgencyId: string | null;
}) {
  if (!hasMultipleAgencies) {
    return propertyRecords;
  }

  if (!selectedAgencyId) {
    return [];
  }

  return propertyRecords
    .map((record) => ({
      ...record,
      engagements: record.engagements.filter(
        (engagement) => engagement.tenant.id === selectedAgencyId
      ),
      agencies: record.agencies.filter((agency) => agency.id === selectedAgencyId)
    }))
    .filter((record) => record.agencies.length > 0);
}

function getUniqueAgenciesFromEngagements(engagements: OwnerEngagement[]) {
  return getUniqueAgencies(engagements.map((engagement) => engagement.tenant));
}

function getUniqueAgencies(values: OwnerAgency[]) {
  const agencies = new Map<string, OwnerAgency>();

  for (const agency of values) {
    agencies.set(agency.id, agency);
  }

  return [...agencies.values()].toSorted((firstAgency, secondAgency) =>
    firstAgency.name.localeCompare(secondAgency.name, 'es')
  );
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
