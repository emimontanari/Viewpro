import { queryOptions } from '@tanstack/react-query';
import {
  getOwnerEngagementTimeline,
  getOwnerProperties,
  getOwnerProperty,
  getOwnerPropertyEngagements
} from './service';
import type { OwnerTimelineFilters } from './types';

export const ownerKeys = {
  all: ['owner'] as const,
  properties: () => [...ownerKeys.all, 'properties'] as const,
  property: (id: string) => [...ownerKeys.properties(), id] as const,
  engagements: (propertyId: string) => [...ownerKeys.property(propertyId), 'engagements'] as const,
  timeline: (engagementId: string, filters: OwnerTimelineFilters) =>
    [...ownerKeys.all, 'engagements', engagementId, 'timeline', filters] as const
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
