import type { ActivityFeedItem } from '@/features/activity/api/types';
import type {
  DashboardSummaryRange,
  DashboardSummaryTopProperty
} from '@/features/dashboard/api/types';
import { RANGE_OPTIONS } from './constants';

const ARGENTINA_LOCALE = 'es-AR';
const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

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

export function formatArgentinaDateTime(instant: string) {
  return new Intl.DateTimeFormat(ARGENTINA_LOCALE, {
    day: 'numeric',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: 'short',
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric'
  }).format(new Date(instant));
}

export function getEngagementHref(engagementId: string) {
  return /^[A-Za-z0-9_-]+$/.test(engagementId) ? `/dashboard/product/${engagementId}` : null;
}

export function formatArgentinaCalendarDate(instant: Date) {
  const parts = new Intl.DateTimeFormat(ARGENTINA_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric'
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? '';

  return {
    dateTime: `${part('year')}-${part('month')}-${part('day')}`,
    label: new Intl.DateTimeFormat(ARGENTINA_LOCALE, {
      day: 'numeric',
      month: 'long',
      timeZone: ARGENTINA_TIME_ZONE,
      weekday: 'long'
    }).format(instant)
  };
}
