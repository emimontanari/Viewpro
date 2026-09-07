import type { ActivityFeedItem } from '@/features/activity/api/types';
import type {
  DashboardSummaryRange,
  DashboardSummaryTopProperty
} from '@/features/dashboard/api/types';
import { navGroups } from '@/config/nav-config';
import { canAccessNavigation, toNavigationAccessContext } from '@/lib/navigation-access';
import { canManagePropertyEngagements, type TenantMembership } from '@/lib/session';
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

export function getDashboardEngagementHref(engagementId: string) {
  if (engagementId.trim() !== engagementId || !/^[A-Za-z0-9_-]+$/.test(engagementId)) {
    return null;
  }

  return `/dashboard/product/${engagementId}`;
}

export function getDashboardSellerHref(sellerId: string) {
  if (sellerId.trim() !== sellerId || !/^[A-Za-z0-9_-]+$/.test(sellerId)) {
    return null;
  }

  return `/dashboard/seguimiento?sellerId=${encodeURIComponent(sellerId)}`;
}

export type ManagerShortcut = {
  description: string;
  href: string;
  icon: keyof typeof import('@/components/icons').Icons;
  label: string;
};

const MANAGER_NAV_SHORTCUTS = [
  { description: 'Consultá las gestiones activas.', href: '/dashboard/product', label: 'Ver propiedades' },
  { description: 'Revisá movimientos y próximos pasos.', href: '/dashboard/seguimiento', label: 'Ver seguimiento' },
  { description: 'Consultá el equipo de la inmobiliaria.', href: '/dashboard/users', label: 'Ver equipo' }
] as const;

function getNavigationItem(href: string) {
  return navGroups.flatMap((group) => group.items).find((item) => item.url === href);
}

export function getManagerShortcuts(
  membership: TenantMembership | null | undefined,
  isTenantLoading: boolean
): ManagerShortcut[] {
  const context = toNavigationAccessContext(membership ?? null, isTenantLoading);

  if (!context.resolved || !context.membership) {
    return [];
  }

  const shortcuts = MANAGER_NAV_SHORTCUTS.flatMap((shortcut) => {
    const item = getNavigationItem(shortcut.href);

    if (!item?.icon || !canAccessNavigation(item.access, context)) {
      return [];
    }

    return [{ ...shortcut, icon: item.icon }];
  });
  const propertyList = shortcuts.find((shortcut) => shortcut.href === '/dashboard/product');

  return propertyList && canManagePropertyEngagements(membership)
    ? [...shortcuts, { description: 'Registrá una gestión nueva.', href: '/dashboard/product/new', icon: 'add', label: 'Nueva propiedad' }]
    : shortcuts;
}

export function formatArgentinaActivityTime(isoDateTime: string) {
  const instant = new Date(isoDateTime);

  if (Number.isNaN(instant.getTime())) {
    return null;
  }

  return {
    dateTime: instant.toISOString(),
    label: new Intl.DateTimeFormat(ARGENTINA_LOCALE, {
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      timeZone: ARGENTINA_TIME_ZONE,
      year: 'numeric'
    }).format(instant)
  };
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
