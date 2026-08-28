import { bffRequest } from '@/lib/bff-client';
import type {
  CreateStatusChangeRequestPayload,
  RejectStatusChangeRequestPayload,
  StatusChangeRequest
} from './types';

const TIMEOUT_MS = 10_000;

export async function getStatusChangeRequestsByEngagement(
  engagementId: string
): Promise<StatusChangeRequest[]> {
  return bffRequest<StatusChangeRequest[]>(
    `/api/products/${engagementId}/status-change-requests`,
    {},
    { timeoutMs: TIMEOUT_MS }
  );
}

export async function getPendingStatusChangeRequests(params: {
  status?: 'PENDING';
  take?: number;
} = {}): Promise<StatusChangeRequest[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.take !== undefined) search.set('take', String(params.take));
  const query = search.toString();
  return bffRequest<StatusChangeRequest[]>(
    `/api/tenants/me/status-change-requests${query ? `?${query}` : ''}`,
    {},
    { timeoutMs: TIMEOUT_MS }
  );
}

export async function createStatusChangeRequest(
  engagementId: string,
  payload: CreateStatusChangeRequestPayload
): Promise<StatusChangeRequest> {
  return bffRequest<StatusChangeRequest>(`/api/products/${engagementId}/status-change-requests`, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  }, { timeoutMs: TIMEOUT_MS });
}

export async function approveStatusChangeRequest(requestId: string): Promise<StatusChangeRequest> {
  return bffRequest<StatusChangeRequest>(`/api/status-change-requests/${requestId}/approve`, {
    method: 'PATCH'
  }, { timeoutMs: TIMEOUT_MS });
}

export async function rejectStatusChangeRequest(
  requestId: string,
  payload: RejectStatusChangeRequestPayload
): Promise<StatusChangeRequest> {
  return bffRequest<StatusChangeRequest>(`/api/status-change-requests/${requestId}/reject`, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH'
  }, { timeoutMs: TIMEOUT_MS });
}
