import type { ColumnDef } from '@tanstack/react-table';
import type {
  Product,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyType
} from '../../api/types';
import { OPERATION_TYPE_OPTIONS, PROPERTY_STATUS_OPTIONS, PROPERTY_TYPE_OPTIONS } from './options';

export const columns: ColumnDef<Product>[] = [
  {
    id: 'property',
    accessorFn: (row) => row.property.title
  },
  {
    id: 'propertyType',
    accessorFn: (row) => row.property.propertyType
  },
  {
    id: 'operationType',
    accessorKey: 'operationType'
  },
  {
    id: 'status',
    accessorKey: 'status'
  },
  {
    id: 'publishedPriceCents',
    accessorKey: 'publishedPriceCents'
  },
  {
    id: 'owner',
    accessorFn: (row) => row.property.ownerName ?? row.property.ownerEmail ?? ''
  },
  {
    id: 'agents',
    accessorFn: (row) => row.agents.length
  },
  {
    id: 'actions'
  }
];

const propertyTypeLabels = createLabelMap<PropertyType>(PROPERTY_TYPE_OPTIONS);
const operationTypeLabels = createLabelMap<PropertyOperationType>(OPERATION_TYPE_OPTIONS);
const statusLabels = createLabelMap<PropertyEngagementStatus>(PROPERTY_STATUS_OPTIONS);

export function getPropertyTypeLabel(value: PropertyType) {
  return propertyTypeLabels[value] ?? value;
}

export function getOperationTypeLabel(value: PropertyOperationType) {
  return operationTypeLabels[value] ?? value;
}

export function getStatusLabel(value: PropertyEngagementStatus) {
  return statusLabels[value] ?? value;
}

export function getAddress(product: Product) {
  return [product.property.addressLine, product.property.city, product.property.province]
    .filter(Boolean)
    .join(', ');
}

export function getPropertyFacts(product: Product) {
  const { bathrooms, bedrooms, coveredAreaSqm, garages, rooms, totalAreaSqm } = product.property;
  const facts: string[] = [];

  if (hasNumber(rooms)) {
    facts.push(`${rooms} amb.`);
  }

  if (hasNumber(bedrooms)) {
    facts.push(`${bedrooms} dorm.`);
  }

  if (hasNumber(bathrooms)) {
    facts.push(`${bathrooms} ${bathrooms === 1 ? 'baño' : 'baños'}`);
  }

  if (hasNumber(garages)) {
    facts.push(`${garages} ${garages === 1 ? 'cochera' : 'cocheras'}`);
  }

  if (hasNumber(coveredAreaSqm)) {
    facts.push(`${coveredAreaSqm} m² cub.`);
  }

  if (hasNumber(totalAreaSqm)) {
    facts.push(`${totalAreaSqm} m² tot.`);
  }

  return facts.join(' · ');
}

export function getAgentSummary(product: Product) {
  const [firstAgent] = product.agents;

  if (!firstAgent) {
    return { detail: 'Sin agente asignado', label: 'Sin asignar' };
  }

  if (product.agents.length === 1) {
    return { detail: firstAgent.email, label: firstAgent.firstName || firstAgent.email };
  }

  return {
    detail: `${firstAgent.email} + ${product.agents.length - 1} más`,
    label: `${firstAgent.firstName || firstAgent.email} +${product.agents.length - 1}`
  };
}

export function formatPrice(value: number | null, currency: string | null) {
  if (value === null) {
    return 'Sin precio';
  }

  return new Intl.NumberFormat('es-AR', {
    currency: currency ?? 'ARS',
    maximumFractionDigits: 0,
    style: 'currency'
  }).format(value / 100);
}

export function getStatusTone(value: PropertyEngagementStatus) {
  const tones: Record<PropertyEngagementStatus, string> = {
    CAPTURE:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300',
    DOCUMENTATION_PENDING:
      'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300',
    PUBLICATION_PREPARATION:
      'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300',
    ACTIVE_PUBLICATION:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    INQUIRIES_AND_VISITS:
      'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300',
    OFFER_NEGOTIATION:
      'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300',
    RESERVATION_STARTED:
      'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800 dark:border-fuchsia-900/60 dark:bg-fuchsia-950/30 dark:text-fuchsia-300',
    FINAL_DOCUMENTATION:
      'border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300',
    CLOSED:
      'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300',
    CANCELLED:
      'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
  };

  return tones[value];
}

export function getOperationTone(value: PropertyOperationType) {
  const tones: Record<PropertyOperationType, string> = {
    SALE: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
    RENT: 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300'
  };

  return tones[value];
}

export function isArchivedProduct(product: Product) {
  return Boolean(product.archivedAt);
}

export function getArchivedTone() {
  return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300';
}

function hasNumber(value: number | null) {
  return typeof value === 'number';
}

function createLabelMap<TValue extends string>(options: Array<{ value: string; label: string }>) {
  return Object.fromEntries(options.map((option) => [option.value, option.label])) as Record<
    TValue,
    string
  >;
}
