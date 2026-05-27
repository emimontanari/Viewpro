'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { propertyTypeOptions } from '@/features/products/constants/product-options';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ownerPropertyEngagementsOptions, ownerPropertyOptions } from '../api/queries';
import type { OwnerProperty } from '../api/types';
import { OwnerEngagementCard } from './owner-engagement-card';
import { OwnerPropertySummary } from './owner-property-summary';

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
  const primaryEngagement = engagements[0] ?? null;

  return (
    <div className='space-y-6'>
      <Button
        asChild
        variant='outline'
        className='group h-11 w-full justify-start rounded-full border-purple-200 bg-purple-50/60 px-4 text-purple-700 shadow-sm transition-all hover:border-purple-300 hover:bg-purple-100 hover:text-purple-800 sm:w-fit dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200 dark:hover:bg-purple-500/20'
      >
        <Link href='/owner'>
          <Icons.chevronLeft className='mr-2 size-4 transition-transform group-hover:-translate-x-0.5' />
          Volver a mis propiedades
        </Link>
      </Button>

      <section className='overflow-hidden rounded-3xl border bg-background shadow-sm'>
        <div className='grid gap-5 p-6 md:grid-cols-[1.5fr_0.7fr] md:p-8'>
          <div className='min-w-0 space-y-3'>
            <Badge variant='secondary'>Detalle propietario</Badge>
            <div className='space-y-2'>
              <h1 className='text-3xl font-semibold tracking-tight break-words md:text-4xl'>
                {property.title}
              </h1>
              <p className='text-muted-foreground break-words'>
                {formatPropertyLocation(property)}
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='outline'>{getPropertyTypeLabel(property.propertyType)}</Badge>
              {primaryEngagement ? (
                <Badge variant='outline'>Inmobiliaria: {primaryEngagement.tenant.name}</Badge>
              ) : null}
            </div>
          </div>
          <div className='rounded-2xl border bg-muted/40 p-5'>
            <p className='text-sm text-muted-foreground'>Seguimiento actual</p>
            <p className='mt-2 text-2xl font-semibold'>
              {primaryEngagement ? getStatusLabel(primaryEngagement.status) : 'Sin gestión activa'}
            </p>
            <p className='mt-2 text-sm text-muted-foreground'>
              {primaryEngagement
                ? `Actualizado por ${primaryEngagement.tenant.name}.`
                : 'La inmobiliaria todavía no informó una gestión activa.'}
            </p>
          </div>
        </div>
      </section>

      <Tabs defaultValue='summary' className='space-y-4'>
        <TabsList className='grid h-auto w-full grid-cols-2 sm:w-fit'>
          <TabsTrigger value='summary'>Resumen</TabsTrigger>
          <TabsTrigger value='tracking'>Seguimiento</TabsTrigger>
        </TabsList>
        <TabsContent value='summary' className='space-y-4'>
          <OwnerPropertySummary property={property} engagement={primaryEngagement} />
        </TabsContent>
        <TabsContent value='tracking' className='space-y-4'>
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
        </TabsContent>
      </Tabs>
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
  return propertyTypeOptions.find((option) => option.value === propertyType)?.label ?? propertyType;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE_PUBLICATION: 'Publicación activa',
    CANCELLED: 'Cancelada',
    CAPTURE: 'Captación',
    CLOSED: 'Cerrada',
    DOCUMENTATION_PENDING: 'Documentación pendiente',
    FINAL_DOCUMENTATION: 'Documentación final',
    INQUIRIES_AND_VISITS: 'Consultas y visitas',
    OFFER_NEGOTIATION: 'Negociación',
    PUBLICATION_PREPARATION: 'Preparando publicación',
    RESERVATION_STARTED: 'Reserva iniciada'
  };

  return labels[status] ?? status;
}
