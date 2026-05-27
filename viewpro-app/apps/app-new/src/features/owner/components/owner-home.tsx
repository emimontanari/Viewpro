'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { propertyStatusOptions } from '@/features/products/constants/product-options';
import { useQueries, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ownerPropertiesOptions, ownerPropertyEngagementsOptions } from '../api/queries';
import type { OwnerEngagement, OwnerProperty } from '../api/types';

type OwnerAgency = {
  id: string;
  name: string;
};

type OwnerPropertyWithAgencies = {
  agencies: OwnerAgency[];
  engagements: OwnerEngagement[];
  property: OwnerProperty;
};

export function OwnerHome() {
  const propertiesQuery = useQuery(ownerPropertiesOptions());
  const properties = propertiesQuery.data ?? [];
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
  return (
    <Card className='py-0'>
      <CardContent className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-center gap-4'>
          <span className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200'>
            <Icons.workspace className='size-6' aria-hidden='true' />
          </span>
          <div className='min-w-0 space-y-1'>
            <h2 className='font-semibold'>Inmobiliaria vinculada</h2>
            <p className='text-sm text-muted-foreground'>
              Esta inmobiliaria te vinculó a {formatPropertyCount(propertyCount)} activas.
            </p>
          </div>
        </div>
        <div className='rounded-xl bg-muted/40 px-4 py-3 text-sm font-medium sm:text-right'>
          <p className='truncate'>{agency.name}</p>
          <p className='mt-1 text-xs text-muted-foreground'>Acceso propietario vigente</p>
        </div>
      </CardContent>
    </Card>
  );
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
  const statusLabel = engagement ? getStatusLabel(engagement.status) : 'Sin gestión activa';

  return (
    <Card className='overflow-hidden py-0 transition-shadow hover:shadow-md'>
      <CardContent className='p-4 sm:p-5'>
        <div className='grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)_260px] lg:items-start'>
          <div className='relative overflow-hidden rounded-2xl bg-muted'>
            {primaryImage ? (
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
            <Badge
              variant='secondary'
              className='absolute right-3 top-3 bg-background/90 backdrop-blur'
            >
              {getPropertyTypeLabel(property.propertyType)}
            </Badge>
          </div>

          <div className='min-w-0 space-y-4'>
            <div className='space-y-2'>
              <h2 className='text-2xl leading-tight font-semibold tracking-tight break-words'>
                {property.title}
              </h2>
              <p className='text-sm text-muted-foreground break-words'>
                {formatPropertyLocation(property)}
              </p>
            </div>

            <OwnerStatusSummary statusLabel={statusLabel} />
          </div>

          <div className='grid content-start gap-3 lg:border-l lg:pl-5'>
            <Button asChild size='lg' className='w-full'>
              <Link href={`/owner/properties/${property.id}`}>
                Abrir propiedad
                <Icons.arrowRight className='ml-2 size-4' aria-hidden='true' />
              </Link>
            </Button>
            <div className='grid grid-cols-2 gap-3 lg:grid-cols-1'>
              <OwnerActionTile
                href={`/owner/properties/${property.id}`}
                icon={Icons.trendingUp}
                label='Seguimiento'
                ariaLabel='Ver seguimiento'
              />
              <OwnerActionTile
                href={`/owner/properties/${property.id}`}
                icon={Icons.page}
                label='Ficha técnica'
                ariaLabel='Ver ficha técnica'
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OwnerStatusSummary({ statusLabel }: { statusLabel: string }) {
  return (
    <Field className='rounded-2xl border bg-muted/30 p-4'>
      <FieldLabel asChild className='w-full items-center text-sm'>
        <div>
          <span className='rounded-full border border-purple-700/25 bg-purple-50 px-3 py-1 font-medium text-purple-600 dark:border-purple-700/40 dark:bg-purple-500/10 dark:text-purple-300'>
            {statusLabel}
          </span>
        </div>
      </FieldLabel>
      <Progress
        value={18}
        aria-hidden='true'
        className='h-1.5 bg-muted [&_[data-slot=progress-indicator]]:bg-[oklch(0.558_0.288_302.321)]'
      />
    </Field>
  );
}

function OwnerActionTile({
  ariaLabel,
  href,
  icon: Icon,
  label
}: {
  ariaLabel: string;
  href: string;
  icon: typeof Icons.product;
  label: string;
}) {
  return (
    <Button asChild variant='outline' className='h-20 w-full flex-col gap-2'>
      <Link href={href} aria-label={ariaLabel}>
        <Icon className='size-5 text-muted-foreground' aria-hidden='true' />
        <span>{label}</span>
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

  return [...agencies.values()].sort((firstAgency, secondAgency) =>
    firstAgency.name.localeCompare(secondAgency.name, 'es')
  );
}

function formatPropertyCount(count: number) {
  return count === 1 ? '1 propiedad' : `${count} propiedades`;
}

function formatPropertyLocation(property: OwnerProperty) {
  return [property.addressLine, property.city, property.province].filter(Boolean).join(', ');
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

function getStatusLabel(status: string) {
  return propertyStatusOptions.find((option) => option.value === status)?.label ?? status;
}
