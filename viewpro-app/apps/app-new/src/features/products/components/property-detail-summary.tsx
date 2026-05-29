import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Product } from '../api/types';
import {
  getAddress,
  getArchivedTone,
  getOperationTone,
  getOperationTypeLabel,
  getPropertyFacts,
  getPropertyTypeLabel,
  getStatusLabel,
  getStatusTone
} from './product-tables/columns';

type PropertyDetailHeaderProps = {
  propertyEngagement: Product;
  pageTitle: string;
  isArchived: boolean;
  isRestoring: boolean;
  isAddingMovement: boolean;
  onBackToList: () => void;
  onRestore: () => void;
  onAddMovement: () => void;
  onEdit: () => void;
};

export function PropertyDetailHeader({
  propertyEngagement,
  pageTitle,
  isArchived,
  isRestoring,
  isAddingMovement,
  onBackToList,
  onRestore,
  onAddMovement,
  onEdit
}: PropertyDetailHeaderProps) {
  const address = getAddress(propertyEngagement) || 'Sin dirección cargada';
  const propertyFacts = getPropertyFacts(propertyEngagement);

  return (
    <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
      <div className='min-w-0 space-y-3'>
        <div className='flex flex-wrap gap-2'>
          <Badge
            variant='outline'
            className={cn('rounded-full', getOperationTone(propertyEngagement.operationType))}
          >
            {getOperationTypeLabel(propertyEngagement.operationType)}
          </Badge>
          <Badge
            variant='outline'
            className={cn('rounded-full', getStatusTone(propertyEngagement.status))}
          >
            {getStatusLabel(propertyEngagement.status)}
          </Badge>
          <Badge variant='outline' className='rounded-full bg-background/70'>
            {getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          </Badge>
          {isArchived ? (
            <Badge variant='outline' className={cn('rounded-full', getArchivedTone())}>
              Archivada
            </Badge>
          ) : null}
        </div>
        <div className='space-y-1'>
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            {pageTitle}
          </p>
          <CardTitle className='break-words text-left text-2xl font-bold md:text-3xl'>
            {propertyEngagement.property.title}
          </CardTitle>
          <p className='break-words text-sm text-muted-foreground'>{address}</p>
          {propertyFacts ? (
            <p className='text-sm font-medium text-muted-foreground'>{propertyFacts}</p>
          ) : null}
        </div>
      </div>

      <div className='flex shrink-0 flex-col gap-2 sm:flex-row lg:justify-end'>
        <Button type='button' variant='outline' onClick={onBackToList}>
          Volver al listado
        </Button>
        {isArchived ? (
          <>
            <Button
              type='button'
              variant='secondary'
              disabled={isRestoring}
              isLoading={isRestoring}
              onClick={onRestore}
            >
              <Icons.check className='mr-2 size-4' />
              Restaurar propiedad
            </Button>
            <p className='max-w-56 text-xs leading-5 text-muted-foreground'>
              Restaurá la propiedad para agregar actualizaciones.
            </p>
          </>
        ) : (
          <Button
            type='button'
            variant='secondary'
            disabled={isAddingMovement}
            onClick={onAddMovement}
          >
            <Icons.add className='mr-2 size-4' />
            Agregar actualización
          </Button>
        )}
        <Button type='button' onClick={onEdit}>
          <Icons.edit className='mr-2 size-4' />
          Editar propiedad
        </Button>
      </div>
    </div>
  );
}

type PropertyReadOnlySectionsProps = {
  propertyEngagement: Product;
};

export function PropertyReadOnlySections({ propertyEngagement }: PropertyReadOnlySectionsProps) {
  return (
    <>
      <section className='space-y-3'>
        <div>
          <h3 className='text-base font-semibold'>Información principal</h3>
          <p className='text-sm text-muted-foreground'>
            Datos base para identificar y publicar la propiedad.
          </p>
        </div>
        <div className='grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4'>
          <ReadOnlyField
            label='Tipo'
            value={getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          />
          <ReadOnlyField
            label='Operación'
            value={getOperationTypeLabel(propertyEngagement.operationType)}
          />
          <ReadOnlyField label='Dirección' value={propertyEngagement.property.addressLine} />
          <ReadOnlyField
            label='Localidad'
            value={`${propertyEngagement.property.city}, ${propertyEngagement.property.province}`}
          />
        </div>
      </section>

      <section className='space-y-3'>
        <div>
          <h3 className='text-base font-semibold'>Características</h3>
          <p className='text-sm text-muted-foreground'>
            Datos físicos registrados para esta propiedad.
          </p>
        </div>
        <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <ReadOnlyField
            label='Superficie total'
            value={formatNumberWithSuffix(propertyEngagement.property.totalAreaSqm, 'm²')}
          />
          <ReadOnlyField
            label='Superficie cubierta'
            value={formatNumberWithSuffix(propertyEngagement.property.coveredAreaSqm, 'm²')}
          />
          <ReadOnlyField
            label='Ambientes'
            value={formatOptionalNumber(propertyEngagement.property.rooms)}
          />
          <ReadOnlyField
            label='Dormitorios'
            value={formatOptionalNumber(propertyEngagement.property.bedrooms)}
          />
          <ReadOnlyField
            label='Baños'
            value={formatOptionalNumber(propertyEngagement.property.bathrooms)}
          />
          <ReadOnlyField
            label='Cocheras'
            value={formatOptionalNumber(propertyEngagement.property.garages)}
          />
          <ReadOnlyField
            label='Antigüedad'
            value={formatNumberWithSuffix(propertyEngagement.property.ageYears, 'años')}
          />
          <ReadOnlyField
            label='Orientación'
            value={propertyEngagement.property.orientation ?? 'Sin dato'}
          />
        </div>
      </section>
    </>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className='min-w-0 space-y-1 rounded-xl border bg-background p-3 shadow-xs'>
      <div className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
        {label}
      </div>
      <div className='break-words text-sm font-medium'>{value}</div>
    </div>
  );
}

function formatOptionalNumber(value: number | null) {
  return value === null ? 'Sin dato' : new Intl.NumberFormat('es-AR').format(value);
}

function formatNumberWithSuffix(value: number | null, suffix: string) {
  return value === null ? 'Sin dato' : `${new Intl.NumberFormat('es-AR').format(value)} ${suffix}`;
}
