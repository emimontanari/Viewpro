import type {
  CreateStatusChangeRequestPayload,
  RejectStatusChangeRequestPayload,
  StatusChangeRequest
} from './types';

const APP_URL =
  typeof window !== 'undefined'
    ? ''
    : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');

const TIMEOUT_MS = 10_000;

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = path.startsWith('http') ? path : `${APP_URL}${path}`;
    return await fetch(url, {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La solicitud tardó demasiado.', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? Array.isArray((body as { message: unknown }).message)
          ? ((body as { message: string[] }).message).join(', ')
          : String((body as { message: unknown }).message)
        : response.statusText;
    throw new Error(message);
  }
  return body as T;
}

export async function getStatusChangeRequestsByEngagement(
  engagementId: string
): Promise<StatusChangeRequest[]> {
  const response = await apiFetch(`/api/products/${engagementId}/status-change-requests`);
  return parseJson<StatusChangeRequest[]>(response);
}

export async function getPendingStatusChangeRequests(params: {
  status?: 'PENDING';
  take?: number;
} = {}): Promise<StatusChangeRequest[]> {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.take !== undefined) search.set('take', String(params.take));
  const query = search.toString();
  const response = await apiFetch(
    `/api/tenants/me/status-change-requests${query ? `?${query}` : ''}`
  );
  return parseJson<StatusChangeRequest[]>(response);
}

export async function createStatusChangeRequest(
  engagementId: string,
  payload: CreateStatusChangeRequestPayload
): Promise<StatusChangeRequest> {
  const response = await apiFetch(`/api/products/${engagementId}/status-change-requests`, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });
  return parseJson<StatusChangeRequest>(response);
}

export async function approveStatusChangeRequest(requestId: string): Promise<StatusChangeRequest> {
  const response = await apiFetch(`/api/status-change-requests/${requestId}/approve`, {
    method: 'PATCH'
  });
  return parseJson<StatusChangeRequest>(response);
}

export async function rejectStatusChangeRequest(
  requestId: string,
  payload: RejectStatusChangeRequestPayload
): Promise<StatusChangeRequest> {
  const response = await apiFetch(`/api/status-change-requests/${requestId}/reject`, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH'
  });
  return parseJson<StatusChangeRequest>(response);
}
