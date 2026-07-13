import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  operationTypeOptions,
  propertyStatusOptions,
  propertyTypeOptions
} from '@/features/products/constants/product-options';
import { PropertyImageCarousel } from '@/features/products/components/property-images';
import type { OwnerEngagement, OwnerProperty } from '../api/types';

export function OwnerPropertySummary({
  engagement,
  property
}: {
  engagement: OwnerEngagement | null;
  property: OwnerProperty;
}) {
  const facts = getPropertyFacts(property);

  return (
    <div className='grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]'>
      <Card className='overflow-hidden p-3'>
        <PropertyImageCarousel images={getOwnerCarouselImages(property)} title={property.title} />
      </Card>

      <div className='space-y-5'>
        <Card>
          <CardHeader>
            <div className='flex flex-wrap gap-2'>
              <Badge variant='secondary'>{getPropertyTypeLabel(property.propertyType)}</Badge>
              {engagement ? (
                <Badge variant='outline'>{getOperationTypeLabel(engagement.operationType)}</Badge>
              ) : null}
              {engagement ? <Badge>{getStatusLabel(engagement.status)}</Badge> : null}
            </div>
            <CardTitle className='text-2xl leading-tight break-words'>{property.title}</CardTitle>
            <p className='text-sm text-muted-foreground break-words'>
              {formatPropertyLocation(property)}
            </p>
          </CardHeader>
          <CardContent className='space-y-4'>
            {engagement ? (
              <div className='rounded-2xl bg-muted/40 p-4'>
                <p className='text-sm text-muted-foreground'>Valor publicado</p>
                <p className='mt-1 text-2xl font-semibold'>
                  {formatMoney(engagement.publishedPriceCents, engagement.currency)}
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Gestión con {engagement.tenant.name}
                </p>
              </div>
            ) : null}

            <div>
              <h2 className='text-base font-semibold'>Ficha técnica</h2>
              {facts.length > 0 ? (
                <dl className='mt-3 grid grid-cols-2 gap-3'>
                  {facts.map((fact) => (
                    <div key={fact.label} className='rounded-xl border bg-background/70 p-3'>
                      <dt className='text-xs text-muted-foreground'>{fact.label}</dt>
                      <dd className='mt-1 text-sm font-semibold'>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className='mt-2 text-sm text-muted-foreground'>
                  La inmobiliaria todavía no cargó datos técnicos visibles.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {engagement ? <OwnerAgencyTeam engagement={engagement} /> : null}
      </div>
    </div>
  );
}

function getOwnerCarouselImages(property: OwnerProperty) {
  if (property.images.length > 0) {
    return property.images;
  }

  return property.primaryImage ? [property.primaryImage] : [];
}

function OwnerAgencyTeam({ engagement }: { engagement: OwnerEngagement }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Inmobiliaria y equipo</CardTitle>
        <p className='text-sm text-muted-foreground'>
          Personas que acompañan esta gestión desde {engagement.tenant.name}.
        </p>
      </CardHeader>
      <CardContent>
        {engagement.agents.length > 0 ? (
          <ul className='grid gap-2'>
            {engagement.agents.map((agent) => (
              <li
                key={agent.userId}
                className='rounded-lg border bg-background/70 px-3 py-2 text-sm'
              >
                <p className='font-medium'>{agent.firstName || agent.email}</p>
                <p className='break-all text-muted-foreground'>{agent.email}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>
            La inmobiliaria todavía no informó vendedores asignados.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type PropertyFact = { label: string; value: number | string };

function getPropertyFacts(property: OwnerProperty) {
  const facts: PropertyFact[] = [];

  addPropertyFact(facts, 'Superficie total', property.totalAreaSqm, (value) => `${value} m²`);
  addPropertyFact(facts, 'Superficie cubierta', property.coveredAreaSqm, (value) => `${value} m²`);
  addPropertyFact(facts, 'Ambientes', property.rooms);
  addPropertyFact(facts, 'Dormitorios', property.bedrooms);
  addPropertyFact(facts, 'Baños', property.bathrooms);
  addPropertyFact(facts, 'Cocheras', property.garages);
  addPropertyFact(facts, 'Antigüedad', property.ageYears, (value) => `${value} años`);
  addPropertyFact(facts, 'Orientación', property.orientation);

  return facts;
}

function addPropertyFact(
  facts: PropertyFact[],
  label: string,
  value: number | string | null,
  formatValue: (value: number | string) => number | string = (item) => item
) {
  if (value === null || value === '') {
    return;
  }

  facts.push({ label, value: formatValue(value) });
}

function formatPropertyLocation(property: OwnerProperty) {
  return [property.addressLine, property.city, property.province].filter(Boolean).join(', ');
}

function getPropertyTypeLabel(propertyType: string) {
  return propertyTypeOptions.find((option) => option.value === propertyType)?.label ?? propertyType;
}

function getOperationTypeLabel(operationType: string) {
  return (
    operationTypeOptions.find((option) => option.value === operationType)?.label ?? operationType
  );
}

function getStatusLabel(status: string) {
  return propertyStatusOptions.find((option) => option.value === status)?.label ?? status;
}

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat('es-AR', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(amountCents / 100);
}
