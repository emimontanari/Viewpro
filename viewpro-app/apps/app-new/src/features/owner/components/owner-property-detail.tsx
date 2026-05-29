'use client';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { propertyTypeOptions } from '@/features/products/constants/product-options';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import {
  ownerDocumentRequestsOptions,
  ownerPropertyEngagementsOptions,
  ownerPropertyOptions
} from '../api/queries';
import type { OwnerEngagement, OwnerProperty } from '../api/types';
import { OwnerDocumentRequests } from './owner-document-requests';
import { OwnerEngagementCard } from './owner-engagement-card';
import { OwnerPropertySummary } from './owner-property-summary';

const OWNER_DOCUMENT_PREFETCH_FILTERS = { pageSize: 20 };

export function OwnerPropertyDetail({ propertyId }: { propertyId: string }) {
  const queryClient = useQueryClient();
  const propertyQuery = useQuery(ownerPropertyOptions(propertyId));
  const engagementsQuery = useQuery(ownerPropertyEngagementsOptions(propertyId));
  const firstEngagementId = engagementsQuery.data?.[0]?.id;

  useEffect(() => {
    if (!firstEngagementId || engagementsQuery.isError) {
      return;
    }

    void queryClient.prefetchQuery(
      ownerDocumentRequestsOptions(firstEngagementId, OWNER_DOCUMENT_PREFETCH_FILTERS)
    );
  }, [engagementsQuery.isError, firstEngagementId, queryClient]);

  if (propertyQuery.isLoading) {
    return <OwnerPropertyDetailSkeleton />;
  }

  if (propertyQuery.isError || !propertyQuery.data) {
    return (
      <OwnerDetailState
        title='No pudimos cargar esta propiedad'
        description='Puede que el acceso ya no esté activo o que el enlace no sea correcto.'
      />
    );
  }

  const property = propertyQuery.data;
  const isEngagementsLoading = engagementsQuery.isLoading;
  const isEngagementsError = engagementsQuery.isError;
  const engagements = isEngagementsError ? [] : (engagementsQuery.data ?? []);
  const primaryEngagement =
    isEngagementsLoading || isEngagementsError ? null : (engagements[0] ?? null);

  return (
    <div className='space-y-6'>
      <Button
        asChild
        variant='ghost'
        className='group h-auto w-fit px-0 py-1 text-purple-700 hover:bg-transparent hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-200'
      >
        <Link href='/owner'>
          <Icons.chevronLeft className='mr-1.5 size-4 transition-transform group-hover:-translate-x-0.5' />
          <span className='font-medium underline-offset-4 group-hover:underline'>
            Volver a mis propiedades
          </span>
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
          <OwnerEngagementStatusPanel
            engagement={primaryEngagement}
            isError={isEngagementsError}
            isLoading={isEngagementsLoading}
          />
        </div>
      </section>

      <Tabs defaultValue='summary' className='space-y-4'>
        <TabsList className='grid h-auto w-full grid-cols-3 sm:w-fit'>
          <TabsTrigger value='summary'>Resumen</TabsTrigger>
          <TabsTrigger value='tracking'>Seguimiento</TabsTrigger>
          <TabsTrigger value='documents'>Documentos</TabsTrigger>
        </TabsList>
        <TabsContent value='summary' className='space-y-4'>
          <OwnerPropertySummary property={property} engagement={primaryEngagement} />
        </TabsContent>
        <TabsContent value='tracking' className='space-y-4'>
          {isEngagementsLoading ? <OwnerEngagementsLoadingState /> : null}
          {isEngagementsError ? (
            <OwnerDetailState
              title='No pudimos cargar el seguimiento'
              description='La propiedad ya está visible. Reintentá en unos instantes para ver la gestión activa.'
            />
          ) : null}
          {!isEngagementsLoading && !isEngagementsError && engagements.length > 0 ? (
            <section className='space-y-4'>
              {engagements.map((engagement) => (
                <OwnerEngagementCard key={engagement.id} engagement={engagement} />
              ))}
            </section>
          ) : null}
          {!isEngagementsLoading && !isEngagementsError && engagements.length === 0 ? (
            <OwnerDetailState
              title='Todavía no hay gestiones activas'
              description='Cuando la inmobiliaria informe avances sobre esta propiedad, los vas a ver acá.'
            />
          ) : null}
        </TabsContent>
        <TabsContent value='documents' className='space-y-4'>
          {isEngagementsLoading ? <OwnerEngagementsLoadingState /> : null}
          {isEngagementsError ? (
            <OwnerDetailState
              title='No pudimos cargar la gestión activa'
              description='Necesitamos la gestión activa para mostrar las solicitudes documentales.'
            />
          ) : null}
          {!isEngagementsLoading && !isEngagementsError && primaryEngagement ? (
            <OwnerDocumentRequests
              agencyName={primaryEngagement.tenant.name}
              propertyEngagementId={primaryEngagement.id}
            />
          ) : null}
          {!isEngagementsLoading && !isEngagementsError && !primaryEngagement ? (
            <OwnerDetailState
              title='Todavía no hay una gestión activa'
              description='Cuando la inmobiliaria active una gestión, vas a ver acá las solicitudes documentales.'
            />
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OwnerEngagementStatusPanel({
  engagement,
  isError,
  isLoading
}: {
  engagement: OwnerEngagement | null;
  isError: boolean;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className='rounded-2xl border bg-muted/40 p-5'>
        <p className='text-sm text-muted-foreground'>Seguimiento actual</p>
        <p className='mt-2 text-2xl font-semibold'>Cargando seguimiento</p>
        <p className='mt-2 text-sm text-muted-foreground'>
          Estamos trayendo la gestión activa de esta propiedad.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className='rounded-2xl border bg-muted/40 p-5'>
        <p className='text-sm text-muted-foreground'>Seguimiento actual</p>
        <p className='mt-2 text-2xl font-semibold'>No disponible</p>
        <p className='mt-2 text-sm text-muted-foreground'>
          La propiedad ya está visible, pero no pudimos cargar la gestión activa.
        </p>
      </div>
    );
  }

  return (
    <div className='rounded-2xl border bg-muted/40 p-5'>
      <p className='text-sm text-muted-foreground'>Seguimiento actual</p>
      <p className='mt-2 text-2xl font-semibold'>
        {engagement ? getStatusLabel(engagement.status) : 'Sin gestión activa'}
      </p>
      <p className='mt-2 text-sm text-muted-foreground'>
        {engagement
          ? `Actualizado por ${engagement.tenant.name}.`
          : 'La inmobiliaria todavía no informó una gestión activa.'}
      </p>
    </div>
  );
}

function OwnerEngagementsLoadingState() {
  return (
    <Card className='border-dashed shadow-none'>
      <CardContent className='py-8 text-center'>
        <h2 className='text-lg font-semibold'>Cargando gestiones activas...</h2>
        <p className='mx-auto mt-2 max-w-xl text-sm text-muted-foreground'>
          Ya mostramos la propiedad mientras llega el seguimiento de la inmobiliaria.
        </p>
      </CardContent>
    </Card>
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
