'use client';

import * as React from 'react';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    <div className='relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#05070c] text-white shadow-2xl shadow-black/30'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(109,40,217,0.32),transparent_34%),radial-gradient(circle_at_80%_0%,rgba(14,165,233,0.16),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_26%)]' />
      <div className='pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:48px_48px]' />

      <div className='relative space-y-6 p-4 sm:p-6 lg:p-8'>
        <section className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.42fr)] lg:items-end'>
          <div className='space-y-3'>
            <Badge className='border-purple-400/30 bg-purple-500/15 text-purple-100 hover:bg-purple-500/20'>
              Portal propietario
            </Badge>
            <div className='space-y-2'>
              <h1 className='text-4xl font-semibold tracking-tight text-white md:text-5xl'>
                Tus propiedades
              </h1>
              <p className='max-w-2xl text-base leading-7 text-white/70 md:text-lg'>
                Seguimiento claro de las gestiones activas que tu inmobiliaria está trabajando.
              </p>
            </div>
          </div>

          {hasMultipleAgencies ? (
            <OwnerAgencySelector
              agencies={agencies}
              selectedAgencyId={effectiveSelectedAgencyId ?? agencies[0]?.id ?? ''}
              onSelectedAgencyChange={setSelectedAgencyId}
            />
          ) : null}
        </section>

        <OwnerMetricGrid
          activeProperties={visibleRecords.length}
          agencyCount={agencies.length}
          engagementCount={visibleEngagements.length}
          latestUpdatedAt={latestUpdatedAt}
        />

        {visibleRecords.length > 0 ? (
          <section className='grid gap-5'>
            {visibleRecords.map((record) => (
              <OwnerPropertyCard key={record.property.id} record={record} />
            ))}
          </section>
        ) : (
          <OwnerFallbackState
            tone='dark'
            title='Todavía no tenés propiedades activas'
            description='Cuando tu inmobiliaria te vincule a una propiedad, vas a poder ver su seguimiento desde este portal.'
          />
        )}

        {!hasMultipleAgencies && currentAgency ? (
          <OwnerAgencySummary agency={currentAgency} propertyCount={visibleRecords.length} />
        ) : null}
      </div>
    </div>
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
      tone: 'bg-purple-500/20 text-purple-200 shadow-purple-500/15',
      value: activeProperties.toString()
    },
    {
      icon: Icons.trendingUp,
      label: 'Gestiones',
      tone: 'bg-sky-500/20 text-sky-200 shadow-sky-500/15',
      value: engagementCount.toString()
    },
    {
      icon: Icons.workspace,
      label: 'Inmobiliarias',
      tone: 'bg-amber-500/20 text-amber-200 shadow-amber-500/15',
      value: agencyCount.toString()
    },
    {
      icon: Icons.calendar,
      label: 'Última act.',
      tone: 'bg-emerald-500/20 text-emerald-200 shadow-emerald-500/15',
      value: latestUpdatedAt ? formatShortDate(latestUpdatedAt) : '—'
    }
  ];

  return (
    <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div
            key={metric.label}
            className='rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/10 backdrop-blur transition-colors hover:bg-white/[0.075]'
          >
            <div className='flex items-center gap-4'>
              <span
                className={cn(
                  'flex size-12 shrink-0 items-center justify-center rounded-2xl shadow-lg',
                  metric.tone
                )}
              >
                <Icon className='size-6' aria-hidden='true' />
              </span>
              <div className='min-w-0'>
                <p className='text-sm text-white/60'>{metric.label}</p>
                <p className='truncate text-3xl font-semibold leading-tight text-white'>
                  {metric.value}
                </p>
              </div>
            </div>
          </div>
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
    <section className='rounded-3xl border border-white/10 bg-white/[0.055] p-5 shadow-lg shadow-black/10 backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-5'>
      <div className='flex min-w-0 items-center gap-4'>
        <span className='flex size-14 shrink-0 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-100 shadow-lg shadow-purple-500/15'>
          <Icons.workspace className='size-7' aria-hidden='true' />
        </span>
        <div className='min-w-0 space-y-1'>
          <h2 className='text-xl font-semibold text-white'>Inmobiliaria vinculada</h2>
          <p className='text-sm text-white/60'>
            Esta inmobiliaria te vinculó a {formatPropertyCount(propertyCount)} activas.
          </p>
        </div>
      </div>
      <div className='mt-4 min-w-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium text-white sm:mt-0 sm:text-right'>
        <p className='truncate'>{agency.name}</p>
        <p className='mt-1 text-xs text-white/50'>Acceso propietario vigente</p>
      </div>
    </section>
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
    <div className='rounded-3xl border border-white/10 bg-white/[0.055] p-4 shadow-lg shadow-black/10 backdrop-blur'>
      <div className='space-y-1'>
        <h2 className='font-semibold text-white'>Seleccioná inmobiliaria</h2>
        <p className='text-sm text-white/60'>
          Tenés propiedades vinculadas con más de una inmobiliaria.
        </p>
      </div>
      <div className='mt-4'>
        <Select value={selectedAgencyId} onValueChange={onSelectedAgencyChange}>
          <SelectTrigger
            aria-label='Inmobiliaria'
            className='w-full border-white/10 bg-black/20 text-white [&_svg]:text-white/60'
          >
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
    </div>
  );
}

function OwnerPropertyCard({ record }: { record: OwnerPropertyWithAgencies }) {
  const property = record.property;
  const engagement = record.engagements[0] ?? null;
  const currentStatusLabel = engagement ? getStatusLabel(engagement.status) : 'Sin gestión activa';
  const primaryImage = property.primaryImage ?? property.images[0] ?? null;

  return (
    <article className='overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.06] shadow-xl shadow-black/20 backdrop-blur'>
      <div className='grid gap-5 p-4 lg:grid-cols-[248px_minmax(0,1fr)_296px] lg:items-stretch lg:p-5'>
        <div className='relative overflow-hidden rounded-3xl bg-white/5'>
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={`Imagen principal de ${property.title}`}
              className='aspect-[16/10] w-full object-cover lg:h-full lg:min-h-[220px] lg:aspect-auto'
            />
          ) : (
            <div className='flex aspect-[16/10] w-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,rgba(109,40,217,0.45),transparent_35%),linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.03))] lg:h-full lg:min-h-[220px]'>
              <div className='text-center'>
                <Icons.media className='mx-auto size-10 text-white/50' aria-hidden='true' />
                <p className='mt-2 text-sm font-medium text-white/70'>Imagen pendiente</p>
              </div>
            </div>
          )}
          <Badge className='absolute right-3 top-3 border-white/10 bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/60'>
            {getPropertyTypeLabel(property.propertyType)}
          </Badge>
        </div>

        <div className='min-w-0 space-y-5 lg:py-1'>
          <div className='space-y-2'>
            <h2 className='text-2xl font-semibold leading-tight tracking-tight text-white md:text-3xl'>
              {property.title}
            </h2>
            <p className='text-base text-white/60'>{formatPropertyLocation(property)}</p>
          </div>

          <div className='flex flex-wrap items-center gap-3 text-sm'>
            <span className='text-white/60'>Etapa actual</span>
            <Badge className='border-white/10 bg-white/10 text-white hover:bg-white/10'>
              {currentStatusLabel}
            </Badge>
          </div>

          <div className='rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4'>
            <p className='text-xs font-medium uppercase tracking-[0.2em] text-purple-200/80'>
              Estado informado
            </p>
            <p className='mt-2 text-lg font-semibold text-white'>{currentStatusLabel}</p>
            <p className='mt-1 text-sm text-white/60'>
              Esta es la etapa actual comunicada por la inmobiliaria.
            </p>
          </div>

          <div className='grid gap-3 md:grid-cols-2'>
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

        <div className='grid content-start gap-3 border-white/10 lg:border-l lg:pl-5'>
          <Button
            asChild
            className='h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-base font-semibold text-white shadow-lg shadow-purple-950/40 hover:from-violet-500 hover:to-purple-500'
          >
            <Link href={`/owner/properties/${property.id}`}>
              Abrir propiedad
              <Icons.arrowRight className='ml-2 size-5' aria-hidden='true' />
            </Link>
          </Button>
          <OwnerActionLink
            href={`/owner/properties/${property.id}`}
            icon={Icons.trendingUp}
            label='Ver seguimiento'
          />
          <OwnerActionLink
            href={`/owner/properties/${property.id}`}
            icon={Icons.page}
            label='Ver ficha técnica'
          />
        </div>
      </div>
    </article>
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
    <div className='flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-black/20 p-3'>
      <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-purple-200'>
        <Icon className='size-5' aria-hidden='true' />
      </span>
      <div className='min-w-0'>
        <p className='text-xs text-white/50'>{label}</p>
        <p className='mt-0.5 truncate text-sm font-medium text-white'>{value}</p>
      </div>
    </div>
  );
}

function OwnerActionLink({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: typeof Icons.product;
  label: string;
}) {
  return (
    <Button
      asChild
      variant='outline'
      className='h-12 justify-start rounded-2xl border-white/10 bg-black/20 text-white hover:border-purple-400/40 hover:bg-purple-500/10 hover:text-white'
    >
      <Link href={href}>
        <Icon className='mr-3 size-5 text-white/75' aria-hidden='true' />
        {label}
      </Link>
    </Button>
  );
}

function OwnerHomeSkeleton() {
  return (
    <div className='overflow-hidden rounded-[2rem] border border-white/10 bg-[#05070c] p-4 shadow-2xl shadow-black/30 sm:p-6 lg:p-8'>
      <div className='h-16 animate-pulse rounded-3xl bg-white/10' />
      <div className='mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <div className='h-24 animate-pulse rounded-3xl bg-white/10' />
        <div className='h-24 animate-pulse rounded-3xl bg-white/10' />
        <div className='h-24 animate-pulse rounded-3xl bg-white/10' />
        <div className='h-24 animate-pulse rounded-3xl bg-white/10' />
      </div>
      <div className='mt-6 h-80 animate-pulse rounded-[1.75rem] bg-white/10' />
    </div>
  );
}

function OwnerFallbackState({
  description,
  tone = 'light',
  title
}: {
  description: string;
  tone?: 'dark' | 'light';
  title: string;
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-dashed p-8 text-center shadow-lg backdrop-blur',
        tone === 'dark'
          ? 'border-white/15 bg-white/[0.055] text-white shadow-black/10'
          : 'border-border bg-background text-foreground shadow-black/5'
      )}
    >
      <h2 className='text-lg font-semibold'>{title}</h2>
      <p
        className={cn(
          'mx-auto mt-2 max-w-xl text-sm',
          tone === 'dark' ? 'text-white/60' : 'text-muted-foreground'
        )}
      >
        {description}
      </p>
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
