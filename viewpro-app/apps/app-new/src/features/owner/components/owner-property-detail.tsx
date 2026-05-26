'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ownerPropertyEngagementsOptions, ownerPropertyOptions } from '../api/queries';
import type { OwnerProperty } from '../api/types';
import { OwnerEngagementCard } from './owner-engagement-card';

export function OwnerPropertyDetail({ propertyId }: { propertyId: string }) {
  const propertyQuery = useQuery(ownerPropertyOptions(propertyId));
  const engagementsQuery = useQuery(ownerPropertyEngagementsOptions(propertyId));

  if (propertyQuery.isLoading || engagementsQuery.isLoading) {
    return <OwnerPropertyDetailSkeleton />;
  }

  if (propertyQuery.isError || engagementsQuery.isError || !propertyQuery.data) {
    return (
      <OwnerDetailState
        title='No pudimos cargar esta propiedad'
        description='Puede que el acceso ya no esté activo o que el enlace no sea correcto.'
      />
    );
  }

  const property = propertyQuery.data;
  const engagements = engagementsQuery.data ?? [];

  return (
    <div className='space-y-6'>
      <Button
        asChild
        variant='ghost'
        className='w-fit px-0 text-muted-foreground hover:text-foreground'
      >
        <Link href='/owner'>← Volver a tus propiedades</Link>
      </Button>

      <section className='rounded-3xl border bg-background p-6 shadow-sm md:p-8'>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div className='min-w-0 space-y-3'>
            <Badge variant='secondary'>Seguimiento propietario</Badge>
            <div className='space-y-2'>
              <h1 className='text-3xl font-semibold tracking-tight break-words md:text-4xl'>
                {property.title}
              </h1>
              <p className='text-muted-foreground break-words'>
                {formatPropertyLocation(property)}
              </p>
            </div>
          </div>
          <Badge variant='outline'>{getPropertyTypeLabel(property.propertyType)}</Badge>
        </div>
      </section>

      {engagements.length > 0 ? (
        <section className='space-y-4'>
          {engagements.map((engagement) => (
            <OwnerEngagementCard key={engagement.id} engagement={engagement} />
          ))}
        </section>
      ) : (
        <OwnerDetailState
          title='Todavía no hay gestiones activas'
          description='Cuando la inmobiliaria informe avances sobre esta propiedad, los vas a ver acá.'
        />
      )}
    </div>
  );
}

function OwnerPropertyDetailSkeleton() {
  return (
    <div className='space-y-4'>
      <div className='h-40 animate-pulse rounded-3xl bg-muted' />
      <div className='h-96 animate-pulse rounded-xl bg-muted' />
    </div>
  );
}

function OwnerDetailState({ title, description }: { title: string; description: string }) {
  return (
    <Card className='border-dashed shadow-none'>
      <CardContent className='py-8 text-center'>
        <h2 className='text-lg font-semibold'>{title}</h2>
        <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>{description}</p>
        <Button asChild variant='outline' className='mt-5'>
          <Link href='/owner'>Volver al portal</Link>
        </Button>
      </CardContent>
    </Card>
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
