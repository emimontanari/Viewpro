import { getDocumentRequestsRefetchInterval } from '@/lib/document-request-refresh';
import { queryOptions } from '@tanstack/react-query';
import { getOwnerNotifications, getOwnerUnreadNotificationCount } from './notifications';
import {
  getOwnerDocumentRequests,
  getOwnerEngagementTimeline,
  getOwnerProperties,
  getOwnerProperty,
  getOwnerPropertyEngagements
} from './service';
import type { OwnerNotificationFilters } from './notifications';
import { OWNER_HOME_RECENT_MOVEMENT_LIMIT } from '../utils/owner-home-engagement-cards';
import type { OwnerDocumentRequestsFilters, OwnerTimelineFilters } from './types';

export const ownerKeys = {
  all: ['owner'] as const,
  properties: () => [...ownerKeys.all, 'properties'] as const,
  property: (id: string) => [...ownerKeys.properties(), id] as const,
  engagements: (propertyId: string) => [...ownerKeys.property(propertyId), 'engagements'] as const,
  timeline: (engagementId: string, filters: OwnerTimelineFilters) =>
    [...ownerKeys.all, 'engagements', engagementId, 'timeline', filters] as const,
  documentRequests: (propertyEngagementId: string, filters: OwnerDocumentRequestsFilters = {}) =>
    [...ownerKeys.all, 'document-requests', propertyEngagementId, filters] as const,
  notifications: (filters: OwnerNotificationFilters = {}) =>
    [...ownerKeys.all, 'notifications', filters] as const,
  unreadNotificationsCount: () => [...ownerKeys.all, 'notifications', 'unread-count'] as const
};

export const ownerPropertiesOptions = () =>
  queryOptions({
    queryKey: ownerKeys.properties(),
    queryFn: getOwnerProperties
  });

export const ownerPropertyOptions = (id: string) =>
  queryOptions({
    queryKey: ownerKeys.property(id),
    queryFn: () => getOwnerProperty(id)
  });

export const ownerPropertyEngagementsOptions = (propertyId: string) =>
  queryOptions({
    queryKey: ownerKeys.engagements(propertyId),
    queryFn: () => getOwnerPropertyEngagements(propertyId)
  });

export const ownerEngagementTimelineOptions = (
  engagementId: string,
  filters: OwnerTimelineFilters = {}
) =>
  queryOptions({
    queryKey: ownerKeys.timeline(engagementId, filters),
    queryFn: () => getOwnerEngagementTimeline(engagementId, filters)
  });

const OWNER_HOME_RECENT_MOVEMENT_FILTERS: OwnerTimelineFilters = {
  order: 'desc',
  page: 1,
  pageSize: OWNER_HOME_RECENT_MOVEMENT_LIMIT
};

/** Bounded owner-home activity, intentionally distinct from the 25-row detail query. */
export const ownerEngagementRecentMovementsOptions = (engagementId: string) =>
  ownerEngagementTimelineOptions(engagementId, OWNER_HOME_RECENT_MOVEMENT_FILTERS);

export const ownerDocumentRequestsOptions = (
  propertyEngagementId: string,
  filters: Omit<OwnerDocumentRequestsFilters, 'propertyEngagementId'> = {}
) =>
  queryOptions({
    queryKey: ownerKeys.documentRequests(propertyEngagementId, filters),
    queryFn: () => getOwnerDocumentRequests({ ...filters, propertyEngagementId }),
    refetchInterval: getDocumentRequestsRefetchInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always'
  });

export const ownerNotificationsOptions = (filters: OwnerNotificationFilters = {}) =>
  queryOptions({
    queryKey: ownerKeys.notifications(filters),
    queryFn: () => getOwnerNotifications(filters)
  });

export const ownerUnreadNotificationsCountOptions = () =>
  queryOptions({
    queryKey: ownerKeys.unreadNotificationsCount(),
    queryFn: () => getOwnerUnreadNotificationCount()
  });
