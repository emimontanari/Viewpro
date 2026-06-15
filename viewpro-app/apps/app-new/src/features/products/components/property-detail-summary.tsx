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
import { SectionHeader } from './section-header';

type PropertyDetailHeaderProps = {
  propertyEngagement: Product;
  pageTitle: string;
  canAddMovement?: boolean;
  canEdit?: boolean;
  canRestore?: boolean;
  isArchived: boolean;
  isRestoring: boolean;
  isAddingMovement: boolean;
  hasPendingStatusRequest?: boolean;
  onBackToList: () => void;
  onRestore: () => void;
  onAddMovement: () => void;
  onEdit: () => void;
};

export function PropertyDetailHeader({
  propertyEngagement,
  pageTitle,
  canAddMovement = true,
  canEdit = true,
  canRestore = true,
  isArchived,
  isRestoring,
  isAddingMovement,
  hasPendingStatusRequest = false,
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
          {hasPendingStatusRequest && !isArchived ? (
            <Badge
              variant='outline'
              className='rounded-full border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
              aria-label={`Estado: ${getStatusLabel(propertyEngagement.status)}, con solicitud de cambio pendiente`}
            >
              Solicitud pendiente
            </Badge>
          ) : null}
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
            {canRestore ? (
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
            ) : null}
            <p className='max-w-56 text-xs leading-5 text-muted-foreground'>
              {canRestore
                ? 'Restaurá la propiedad para agregar actualizaciones.'
                : 'La propiedad está archivada. Pedile a un manager que la restaure.'}
            </p>
          </>
        ) : canAddMovement ? (
          <Button
            type='button'
            variant='secondary'
            disabled={isAddingMovement}
            onClick={onAddMovement}
          >
            <Icons.add className='mr-2 size-4' />
            Agregar actualización
          </Button>
        ) : null}
        {canEdit ? (
          <Button type='button' onClick={onEdit}>
            <Icons.edit className='mr-2 size-4' />
            Editar propiedad
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type PropertyReadOnlySectionsProps = {
  className?: string;
  density?: 'default' | 'compact';
  propertyEngagement: Product;
};

export function PropertyReadOnlySections({
  className,
  density = 'default',
  propertyEngagement
}: PropertyReadOnlySectionsProps) {
  return (
    <div
      data-testid='property-read-only-sections'
      className={cn('space-y-6', density === 'compact' ? 'space-y-4' : null, className)}
    >
      <section className='space-y-3'>
        <SectionHeader
          description='Datos base para identificar y publicar la propiedad.'
          icon={Icons.info}
          label='Información principal'
        />
        <div
          data-testid='property-main-info-grid'
          className='grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-4'
        >
          <ReadOnlyField
            density={density}
            label='Tipo'
            value={getPropertyTypeLabel(propertyEngagement.property.propertyType)}
          />
          <ReadOnlyField
            density={density}
            label='Operación'
            value={getOperationTypeLabel(propertyEngagement.operationType)}
          />
          <ReadOnlyField
            density={density}
            label='Dirección'
            value={propertyEngagement.property.addressLine}
          />
          <ReadOnlyField
            density={density}
            label='Localidad'
            value={`${propertyEngagement.property.city}, ${propertyEngagement.property.province}`}
          />
        </div>
      </section>

      <section className='space-y-3'>
        <SectionHeader
          description='Datos físicos registrados para esta propiedad.'
          icon={Icons.grid}
          label='Características'
        />
        <div
          data-testid='property-characteristics-grid'
          className='grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4'
        >
          <ReadOnlyField
            density={density}
            label='Superficie total'
            value={formatNumberWithSuffix(propertyEngagement.property.totalAreaSqm, 'm²')}
          />
          <ReadOnlyField
            density={density}
            label='Superficie cubierta'
            value={formatNumberWithSuffix(propertyEngagement.property.coveredAreaSqm, 'm²')}
          />
          <ReadOnlyField
            density={density}
            label='Ambientes'
            value={formatOptionalNumber(propertyEngagement.property.rooms)}
          />
          <ReadOnlyField
            density={density}
            label='Dormitorios'
            value={formatOptionalNumber(propertyEngagement.property.bedrooms)}
          />
          <ReadOnlyField
            density={density}
            label='Baños'
            value={formatOptionalNumber(propertyEngagement.property.bathrooms)}
          />
          <ReadOnlyField
            density={density}
            label='Cocheras'
            value={formatOptionalNumber(propertyEngagement.property.garages)}
          />
          <ReadOnlyField
            density={density}
            label='Antigüedad'
            value={formatNumberWithSuffix(propertyEngagement.property.ageYears, 'años')}
          />
          <ReadOnlyField
            density={density}
            label='Orientación'
            value={propertyEngagement.property.orientation ?? 'Sin dato'}
          />
        </div>
      </section>
    </div>
  );
}

function ReadOnlyField({
  density,
  label,
  value
}: {
  density: 'default' | 'compact';
  label: string;
  value: string;
}) {
  return (
    <div
      data-slot='property-read-only-field'
      className={cn(
        'min-w-0 space-y-1 rounded-xl border bg-background shadow-xs',
        density === 'compact' ? 'p-2 sm:p-2.5' : 'p-2.5 sm:p-3'
      )}
    >
      <div className='text-[0.68rem] font-medium tracking-wide text-muted-foreground uppercase sm:text-xs'>
        {label}
      </div>
      <div className='break-words text-sm leading-snug font-semibold'>{value}</div>
    </div>
  );
}

function formatOptionalNumber(value: number | null) {
  return value === null ? 'Sin dato' : new Intl.NumberFormat('es-AR').format(value);
}

function formatNumberWithSuffix(value: number | null, suffix: string) {
  return value === null ? 'Sin dato' : `${new Intl.NumberFormat('es-AR').format(value)} ${suffix}`;
}
