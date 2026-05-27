'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
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
  property: OwnerProperty;
};

export function OwnerHome() {
  const propertiesQuery = useQuery(ownerPropertiesOptions());
  const properties = propertiesQuery.data ?? [];
  const engagementQueries = useQueries({
    queries: properties.map((property) => ownerPropertyEngagementsOptions(property.id))
  });
  const propertyRecords = React.useMemo(
    () => buildOwnerPropertyAgencyRecords(properties, engagementQueries.map((query) => query.data)),
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
        : agencies[0]?.id ?? null
    );
  }, [agencies, hasMultipleAgencies]);

  if (propertiesQuery.isLoading || engagementQueries.some((query) => query.isLoading)) {
    return <OwnerHomeSkeleton />;
  }

  if (propertiesQuery.isError) {
    return (
      <OwnerShellState
        title='No pudimos cargar tus propiedades'
        description='Intentá actualizar la página. Si el problema continúa, contactá a tu inmobiliaria.'
      />
    );
  }

  if (engagementQueries.some((query) => query.isError)) {
    return (
      <OwnerShellState
        title='No pudimos cargar tus inmobiliarias'
        description='Intentá actualizar la página para ver las propiedades que tenés vinculadas con cada inmobiliaria.'
      />
    );
  }

  const visibleRecords = getVisibleOwnerPropertyRecords({
    hasMultipleAgencies,
    propertyRecords,
    selectedAgencyId
  });
  const selectedAgency = agencies.find((agency) => agency.id === selectedAgencyId) ?? null;

  return (
    <div className='space-y-6'>
      <section className='overflow-hidden rounded-3xl border bg-background shadow-sm'>
        <div className='grid gap-6 p-6 md:grid-cols-[1.6fr_0.8fr] md:p-8'>
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
            <p className='mt-2 text-4xl font-semibold'>{visibleRecords.length}</p>
            <p className='mt-2 text-sm text-muted-foreground'>
              {selectedAgency
                ? `Con acceso propietario vigente en ${selectedAgency.name}.`
                : 'Con acceso propietario vigente en ViewPro.'}
            </p>
          </div>
        </div>
      </section>

      {hasMultipleAgencies ? (
        <OwnerAgencySelector
          agencies={agencies}
          selectedAgencyId={selectedAgencyId ?? agencies[0]?.id ?? ''}
          onSelectedAgencyChange={setSelectedAgencyId}
        />
      ) : null}

      {visibleRecords.length > 0 ? (
        <section className='grid gap-4 md:grid-cols-2'>
          {visibleRecords.map((record) => (
            <OwnerPropertyCard key={record.property.id} property={record.property} />
          ))}
        </section>
      ) : (
        <OwnerShellState
          title='Todavía no tenés propiedades activas'
          description='Cuando tu inmobiliaria te vincule a una propiedad, vas a poder ver su seguimiento desde este portal.'
        />
      )}
    </div>
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
    <div className='rounded-2xl border bg-background p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4'>
      <div className='space-y-1'>
        <h2 className='font-semibold'>Seleccioná inmobiliaria</h2>
        <p className='text-sm text-muted-foreground'>
          Tenés propiedades vinculadas con más de una inmobiliaria.
        </p>
      </div>
      <div className='mt-4 sm:mt-0 sm:w-72'>
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
    </div>
  );
}

function OwnerPropertyCard({ property }: { property: OwnerProperty }) {
  return (
    <Card className='overflow-hidden transition-shadow hover:shadow-md'>
      <CardHeader className='space-y-3'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 space-y-1'>
            <CardTitle className='text-xl leading-tight break-words'>{property.title}</CardTitle>
            <p className='text-sm text-muted-foreground break-words'>
              {formatPropertyLocation(property)}
            </p>
          </div>
          <Badge variant='outline'>{getPropertyTypeLabel(property.propertyType)}</Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-sm text-muted-foreground'>
          Revisá los avances comerciales y próximos pasos informados por la inmobiliaria.
        </p>
        <Button asChild className='w-full sm:w-auto'>
          <Link href={`/owner/properties/${property.id}`}>Ver seguimiento</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OwnerHomeSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='h-48 animate-pulse rounded-3xl bg-muted' />
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='h-56 animate-pulse rounded-xl bg-muted' />
        <div className='h-56 animate-pulse rounded-xl bg-muted' />
      </div>
    </div>
  );
}

function OwnerShellState({ title, description }: { title: string; description: string }) {
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
  return properties.map((property, index) => ({
    property,
    agencies: getUniqueAgencies(engagementsByProperty[index] ?? [])
  }));
}

function getOwnerAgencies(propertyRecords: OwnerPropertyWithAgencies[]) {
  return getUniqueAgencies(propertyRecords.flatMap((record) => record.agencies));
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
  if (!hasMultipleAgencies || !selectedAgencyId) {
    return propertyRecords;
  }

  return propertyRecords.filter((record) =>
    record.agencies.some((agency) => agency.id === selectedAgencyId)
  );
}

function getUniqueAgencies(values: Array<OwnerAgency | OwnerEngagement>) {
  const agencies = new Map<string, OwnerAgency>();

  for (const value of values) {
    const agency = 'tenant' in value ? value.tenant : value;
    agencies.set(agency.id, agency);
  }

  return [...agencies.values()].sort((firstAgency, secondAgency) =>
    firstAgency.name.localeCompare(secondAgency.name, 'es')
  );
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
