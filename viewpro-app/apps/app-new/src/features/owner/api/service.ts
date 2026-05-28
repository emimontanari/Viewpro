import type {
  CreateOwnerDocumentUploadUrlPayload,
  CreateOwnerDocumentUploadUrlResponse,
  OwnerDocumentRequestsFilters,
  OwnerDocumentRequestsResponse,
  OwnerDocumentUploadFileOptions,
  OwnerDocumentUploadResponse,
  OwnerDocumentVersion,
  OwnerDocumentVersionUrlResponse,
  OwnerEngagementsResponse,
  OwnerPropertiesResponse,
  OwnerProperty,
  OwnerSignedStorageUrl,
  OwnerTimelineFilters,
  OwnerTimelineResponse
} from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const OWNER_API_PATH = '/api/owner';
const OWNER_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getOwnerProperties(): Promise<OwnerPropertiesResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/properties`);
  return parseJsonResponse<OwnerPropertiesResponse>(response);
}

export async function getOwnerProperty(id: string): Promise<OwnerProperty> {
  const response = await apiFetch(`${OWNER_API_PATH}/properties/${id}`);
  return parseJsonResponse<OwnerProperty>(response);
}

export async function getOwnerPropertyEngagements(id: string): Promise<OwnerEngagementsResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/properties/${id}/engagements`);
  return parseJsonResponse<OwnerEngagementsResponse>(response);
}

export async function getOwnerEngagementTimeline(
  id: string,
  filters: OwnerTimelineFilters = {}
): Promise<OwnerTimelineResponse> {
  const response = await apiFetch(
    `${OWNER_API_PATH}/engagements/${id}/timeline${buildTimelineQuery(filters)}`
  );
  return parseJsonResponse<OwnerTimelineResponse>(response);
}

export async function getOwnerDocumentRequests(
  filters: OwnerDocumentRequestsFilters = {}
): Promise<OwnerDocumentRequestsResponse> {
  const response = await apiFetch(
    `${OWNER_API_PATH}/document-requests${buildDocumentRequestsQuery(filters)}`
  );
  return parseJsonResponse<OwnerDocumentRequestsResponse>(response);
}

export async function createOwnerDocumentUploadUrl(
  requestId: string,
  payload: CreateOwnerDocumentUploadUrlPayload
): Promise<CreateOwnerDocumentUploadUrlResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/document-requests/${requestId}/upload-url`, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<CreateOwnerDocumentUploadUrlResponse>(response);
}

export async function uploadOwnerDocumentFile(
  uploadUrl: OwnerSignedStorageUrl,
  fileOrBlob: Blob,
  options: OwnerDocumentUploadFileOptions = {}
): Promise<OwnerDocumentUploadResponse> {
  const mimeType = options.mimeType ?? fileOrBlob.type;

  if (!mimeType) {
    throw new Error('El tipo de archivo es requerido para subir documentos.');
  }

  const response = await fetch(getFetchUrl(uploadUrl.url), {
    body: fileOrBlob,
    headers: { 'content-type': mimeType },
    method: 'PUT'
  });

  return parseJsonResponse<OwnerDocumentUploadResponse>(response);
}

export async function confirmOwnerDocumentUpload(versionId: string): Promise<OwnerDocumentVersion> {
  const response = await apiFetch(
    `${OWNER_API_PATH}/document-versions/${versionId}/confirm-upload`,
    {
      method: 'POST'
    }
  );

  return parseJsonResponse<OwnerDocumentVersion>(response);
}

export async function createOwnerDocumentReadUrl(
  versionId: string
): Promise<OwnerDocumentVersionUrlResponse> {
  const response = await apiFetch(`${OWNER_API_PATH}/document-versions/${versionId}/read-url`, {
    method: 'POST'
  });

  return parseJsonResponse<OwnerDocumentVersionUrlResponse>(response);
}

function buildTimelineQuery(filters: OwnerTimelineFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'page', filters.page);
  appendSearchParam(searchParams, 'pageSize', filters.pageSize);
  appendSearchParam(searchParams, 'order', filters.order);

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function buildDocumentRequestsQuery(filters: OwnerDocumentRequestsFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'propertyEngagementId', filters.propertyEngagementId);
  appendSearchParam(searchParams, 'page', filters.page);
  appendSearchParam(searchParams, 'pageSize', filters.pageSize);
  appendSearchParam(searchParams, 'status', filters.status);

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function appendSearchParam(
  searchParams: URLSearchParams,
  key: string,
  value: number | string | undefined
) {
  if (value === undefined || value === '') {
    return;
  }

  searchParams.set(key, String(value));
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OWNER_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('El portal propietario tardó demasiado.', { cause: error });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getFetchUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://') || typeof window !== 'undefined') {
    return path;
  }

  return `${APP_URL}${path}`;
}

async function parseJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.statusText));
  }

  return body as TResponse;
}

function getErrorMessage(body: unknown, fallback: string) {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.join(', ');
    }
  }

  return fallback;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
