import type { ColumnDef } from '@tanstack/react-table';
import type {
  Product,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyType
} from '../../api/types';
import {
  getProductStatusBadgeTone,
  propertyEngagementToneByStatus,
  propertyOperationToneByType
} from '../status-tones';
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
    return { detail: 'Sin vendedor asignado', label: 'Sin asignar' };
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
  return getProductStatusBadgeTone(propertyEngagementToneByStatus[value]);
}

export function getOperationTone(value: PropertyOperationType) {
  return getProductStatusBadgeTone(propertyOperationToneByType[value]);
}

export function isArchivedProduct(product: Product) {
  return Boolean(product.archivedAt);
}

export function getArchivedTone() {
  return getProductStatusBadgeTone('neutral');
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
