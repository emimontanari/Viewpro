import type { ActivityFeedItem } from '@/features/activity/api/types';
import type {
  DashboardSummaryRange,
  DashboardSummaryTopProperty
} from '@/features/dashboard/api/types';
import { RANGE_OPTIONS } from './constants';

/**
 * Pure label helpers. Extracted so the presentational files can share them
 * without importing each other for a string.
 */

export function getActivityTitle(item: ActivityFeedItem) {
  if (item.kind === 'document_request') {
    return item.documentRequest.title;
  }

  return item.observation;
}

export function getActivityDescription(item: ActivityFeedItem) {
  const propertyTitle = getActivityPropertyTitle(item.property);

  if (item.kind === 'document_request') {
    return `Solicitud documental en ${propertyTitle}`;
  }

  return item.nextStep ? `${propertyTitle} · Próximo paso: ${item.nextStep}` : propertyTitle;
}

export function getActivityPropertyTitle(property: ActivityFeedItem['property']) {
  return property.title || property.addressLine || 'Propiedad sin título';
}

export function getDashboardPropertyTitle(property: DashboardSummaryTopProperty) {
  return property.title || property.addressLine || 'Propiedad sin título';
}

export function formatCount(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function getRangeOption(range: DashboardSummaryRange) {
  return RANGE_OPTIONS.find((option) => option.range === range) ?? RANGE_OPTIONS[0];
}
