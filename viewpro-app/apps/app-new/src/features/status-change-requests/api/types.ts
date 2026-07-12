import * as z from 'zod';
import type { PropertyEngagementStatus } from '@/features/products/api/types';

export type { PropertyEngagementStatus };

export const PROPERTY_ENGAGEMENT_STATUSES = [
  'CAPTURE',
  'DOCUMENTATION_PENDING',
  'PUBLICATION_PREPARATION',
  'ACTIVE_PUBLICATION',
  'INQUIRIES_AND_VISITS',
  'OFFER_NEGOTIATION',
  'RESERVATION_STARTED',
  'FINAL_DOCUMENTATION',
  'CLOSED',
  'CANCELLED'
] as const satisfies PropertyEngagementStatus[];

export const createStatusChangeRequestSchema = z.object({
  targetStatus: z.enum(PROPERTY_ENGAGEMENT_STATUSES),
  currentStatusSnapshot: z.enum(PROPERTY_ENGAGEMENT_STATUSES),
  requestNote: z.string().max(1000).optional()
});

export const rejectStatusChangeRequestSchema = z.object({
  resolutionComment: z.string().min(1).max(1000)
});

export type CreateStatusChangeRequestPayload = z.infer<typeof createStatusChangeRequestSchema>;
export type RejectStatusChangeRequestPayload = z.infer<typeof rejectStatusChangeRequestSchema>;

export type StatusChangeRequestStatus = 'PENDING' | 'RESOLVED';

export type StatusChangeRequest = {
  id: string;
  tenantId: string;
  propertyEngagementId: string;
  requestedByUserId: string;
  targetStatus: PropertyEngagementStatus;
  currentStatusSnapshot: PropertyEngagementStatus;
  requestNote: string | null;
  status: StatusChangeRequestStatus;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  resolutionComment: string | null;
  createdAt: string;
  updatedAt: string;
  /** Included by the bandeja endpoint only. */
  propertyTitle?: string;
};
