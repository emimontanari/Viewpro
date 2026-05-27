'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { propertyStatusOptions } from '@/features/products/constants/product-options';
import { cn } from '@/lib/utils';
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

  React.useEffect(() => {
    if (!hasMultipleAgencies) {
      setSelectedAgencyId(null);
      return;
    }

    setSelectedAgencyId((currentAgencyId) =>
      currentAgencyId && agencies.some((agency) => agency.id === currentAgencyId)
        ? currentAgencyId
        : (agencies[0]?.id ?? null)
    );
  }, [agencies, hasMultipleAgencies]);

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
  const visibleEngagements = visibleRecords.flatMap((record) => record.engagements);
  const latestUpdatedAt = getLatestUpdatedAt(visibleRecords);

  return (
    <div className='space-y-6'>
      <OwnerHeroSummary
        activeProperties={visibleRecords.length}
        currentAgency={currentAgency}
        latestUpdatedAt={latestUpdatedAt}
      />

      <OwnerMetricGrid
        activeProperties={visibleRecords.length}
        agencyCount={agencies.length}
        engagementCount={visibleEngagements.length}
        latestUpdatedAt={latestUpdatedAt}
      />

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

function OwnerHeroSummary({
  activeProperties,
  currentAgency,
  latestUpdatedAt
}: {
  activeProperties: number;
  currentAgency: OwnerAgency | null;
  latestUpdatedAt: string | null;
}) {
  return (
    <section className='overflow-hidden rounded-3xl border bg-background shadow-sm'>
      <div className='grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_280px] md:p-8'>
        <div className='space-y-3'>
          <Badge variant='secondary'>Portal propietario</Badge>
          <div className='space-y-2'>
            <h1 className='text-3xl font-semibold tracking-tight md:text-4xl'>Tus propiedades</h1>
            <p className='max-w-2xl text-muted-foreground'>
              Seguimiento claro de las gestiones activas que tu inmobiliaria está trabajando.
            </p>
          </div>
        </div>
        <div className='rounded-2xl border bg-muted/40 p-5'>
          <p className='text-sm text-muted-foreground'>Propiedades activas</p>
          <p className='mt-2 text-4xl font-semibold'>{activeProperties}</p>
          <p className='mt-2 text-sm text-muted-foreground'>
            {currentAgency
              ? `Con acceso propietario vigente en ${currentAgency.name}.`
              : 'Con acceso propietario vigente en ViewPro.'}
          </p>
          {latestUpdatedAt ? (
            <p className='mt-3 text-xs text-muted-foreground'>
              Última actualización: {formatShortDate(latestUpdatedAt)}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function OwnerMetricGrid({
  activeProperties,
  agencyCount,
  engagementCount,
  latestUpdatedAt
}: {
  activeProperties: number;
  agencyCount: number;
  engagementCount: number;
  latestUpdatedAt: string | null;
}) {
  const metrics = [
    {
      icon: Icons.product,
      label: 'Activas',
      value: activeProperties.toString(),
      className: 'bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200'
    },
    {
      icon: Icons.trendingUp,
      label: 'Gestiones',
      value: engagementCount.toString(),
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-200'
    },
    {
      icon: Icons.workspace,
      label: 'Inmobiliarias',
      value: agencyCount.toString(),
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
    },
    {
      icon: Icons.calendar,
      label: 'Última act.',
      value: latestUpdatedAt ? formatShortDate(latestUpdatedAt) : '—',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
    }
  ];

  return (
    <section className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <Card key={metric.label} className='py-0'>
            <CardContent className='flex items-center gap-3 p-4'>
              <span
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-xl',
                  metric.className
                )}
              >
                <Icon className='size-5' aria-hidden='true' />
              </span>
              <div className='min-w-0'>
                <p className='truncate text-sm text-muted-foreground'>{metric.label}</p>
                <p className='truncate text-2xl font-semibold leading-tight'>{metric.value}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
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
      <div className='grid gap-0 lg:grid-cols-[minmax(260px,0.45fr)_minmax(0,1fr)_260px]'>
        <div className='relative bg-muted'>
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={`Imagen principal de ${property.title}`}
              className='aspect-[16/10] w-full object-cover lg:h-full lg:min-h-[260px] lg:aspect-auto'
            />
          ) : (
            <div className='flex aspect-[16/10] w-full items-center justify-center bg-muted lg:h-full lg:min-h-[260px]'>
              <div className='text-center text-muted-foreground'>
                <Icons.media className='mx-auto size-10' aria-hidden='true' />
                <p className='mt-2 text-sm font-medium'>Imagen pendiente</p>
              </div>
            </div>
          )}
          <Badge variant='secondary' className='absolute right-3 top-3 bg-background/90 backdrop-blur'>
            {getPropertyTypeLabel(property.propertyType)}
          </Badge>
        </div>

        <div className='min-w-0 space-y-5 p-5 md:p-6'>
          <div className='space-y-2'>
            <h2 className='text-2xl leading-tight font-semibold tracking-tight break-words'>
              {property.title}
            </h2>
            <p className='text-sm text-muted-foreground break-words'>
              {formatPropertyLocation(property)}
            </p>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <span className='text-sm text-muted-foreground'>Etapa actual</span>
            <Badge className='border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-50 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200'>
              {statusLabel}
            </Badge>
          </div>

          <div className='rounded-2xl border bg-muted/30 p-4'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
              Estado informado
            </p>
            <p className='mt-1 font-semibold'>{statusLabel}</p>
            <p className='mt-1 text-sm text-muted-foreground'>
              Esta es la etapa actual comunicada por la inmobiliaria.
            </p>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <OwnerPropertyInfoCard
              icon={Icons.calendar}
              label='Última actualización'
              value={engagement ? formatFullDate(engagement.updatedAt) : 'Sin novedades todavía'}
            />
            <OwnerPropertyInfoCard
              icon={Icons.workspace}
              label='Inmobiliaria'
              value={engagement ? `${engagement.tenant.name} · activa` : 'Pendiente de vinculación'}
            />
          </div>
        </div>

        <CardContent className='grid content-start gap-3 border-t p-5 lg:border-l lg:border-t-0 lg:p-5'>
          <Button asChild size='lg' className='w-full'>
            <Link href={`/owner/properties/${property.id}`}>
              Abrir propiedad
              <Icons.arrowRight className='ml-2 size-4' aria-hidden='true' />
            </Link>
          </Button>
          <OwnerActionButton
            href={`/owner/properties/${property.id}`}
            icon={Icons.trendingUp}
            label='Ver seguimiento'
          />
          <OwnerActionButton
            href={`/owner/properties/${property.id}`}
            icon={Icons.page}
            label='Ver ficha técnica'
          />
        </CardContent>
      </div>
    </Card>
  );
}

function OwnerPropertyInfoCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof Icons.product;
  label: string;
  value: string;
}) {
  return (
    <div className='flex min-w-0 gap-3 rounded-xl border bg-background/70 p-3'>
      <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-200'>
        <Icon className='size-4' aria-hidden='true' />
      </span>
      <div className='min-w-0'>
        <p className='text-xs text-muted-foreground'>{label}</p>
        <p className='mt-0.5 truncate text-sm font-medium'>{value}</p>
      </div>
    </div>
  );
}

function OwnerActionButton({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: typeof Icons.product;
  label: string;
}) {
  return (
    <Button asChild variant='outline' className='w-full justify-start'>
      <Link href={href}>
        <Icon className='mr-2 size-4 text-muted-foreground' aria-hidden='true' />
        {label}
      </Link>
    </Button>
  );
}

function OwnerHomeSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='h-48 animate-pulse rounded-3xl bg-muted' />
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <div className='h-24 animate-pulse rounded-xl bg-muted' />
        <div className='h-24 animate-pulse rounded-xl bg-muted' />
        <div className='h-24 animate-pulse rounded-xl bg-muted' />
        <div className='h-24 animate-pulse rounded-xl bg-muted' />
      </div>
      <div className='h-80 animate-pulse rounded-xl bg-muted' />
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

function getLatestUpdatedAt(propertyRecords: OwnerPropertyWithAgencies[]) {
  const timestamps = propertyRecords
    .flatMap((record) => record.engagements.map((engagement) => engagement.updatedAt))
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.max(...timestamps)).toISOString();
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short'
  })
    .format(new Date(value))
    .replace('.', '');
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  })
    .format(new Date(value))
    .replace('.', '');
}
