'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ownerPropertiesOptions } from '../api/queries';
import type { OwnerProperty } from '../api/types';

export function OwnerHome() {
  const propertiesQuery = useQuery(ownerPropertiesOptions());

  if (propertiesQuery.isLoading) {
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

  const properties = propertiesQuery.data ?? [];

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
            <p className='mt-2 text-4xl font-semibold'>{properties.length}</p>
            <p className='mt-2 text-sm text-muted-foreground'>
              Con acceso propietario vigente en ViewPro.
            </p>
          </div>
        </div>
      </section>

      {properties.length > 0 ? (
        <section className='grid gap-4 md:grid-cols-2'>
          {properties.map((property) => (
            <OwnerPropertyCard key={property.id} property={property} />
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
