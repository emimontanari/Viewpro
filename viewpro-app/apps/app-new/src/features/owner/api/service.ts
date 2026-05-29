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
const FAKE_DOCUMENT_STORAGE_HOST = 'fake-documents.local';
const FAKE_DOCUMENT_STORAGE_MESSAGE =
  'La API está usando almacenamiento documental fake. Para subir o abrir documentos desde el navegador, reiniciá la API con DOCUMENT_STORAGE_DRIVER=local y API_PUBLIC_URL=http://localhost:3001.';
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

  assertBrowserReachableDocumentStorageUrl(uploadUrl.url);

  return uploadBlobWithProgress(
    uploadUrl,
    getFetchUrl(uploadUrl.url),
    fileOrBlob,
    mimeType,
    options
  );
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
  const body = await parseJsonResponse<OwnerDocumentVersionUrlResponse>(response);

  assertBrowserReachableDocumentStorageUrl(body.readUrl.url);

  return body;
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

function assertBrowserReachableDocumentStorageUrl(url: string) {
  if (isFakeDocumentStorageUrl(url)) {
    throw new Error(FAKE_DOCUMENT_STORAGE_MESSAGE);
  }
}

function isFakeDocumentStorageUrl(value: string) {
  try {
    return new URL(value).hostname === FAKE_DOCUMENT_STORAGE_HOST;
  } catch {
    return false;
  }
}

async function parseJsonResponse<TResponse>(response: Response): Promise<TResponse> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.statusText));
  }

  return body as TResponse;
}

function uploadBlobWithProgress(
  uploadUrl: OwnerSignedStorageUrl,
  url: string,
  fileOrBlob: Blob,
  mimeType: string,
  options: OwnerDocumentUploadFileOptions
): Promise<OwnerDocumentUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', mimeType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percent: Math.min(100, Math.round((event.loaded / event.total) * 100))
        });
        return;
      }

      options.onProgress?.({ loaded: event.loaded, total: 0, percent: 35 });
    };

    xhr.onerror = () => reject(new Error('No se pudo subir el documento.'));
    xhr.ontimeout = () => reject(new Error('La carga del documento tardó demasiado.'));
    xhr.onload = () => {
      const body = parseJson(xhr.responseText);

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(getErrorMessage(body, xhr.statusText || 'No se pudo subir el documento')));
        return;
      }

      resolve(
        (body as OwnerDocumentUploadResponse | undefined) ?? {
          storageKey: uploadUrl.storageKey,
          sizeBytes: fileOrBlob.size,
          mimeType
        }
      );
    };

    xhr.send(fileOrBlob);
  });
}

function parseJson(value: string) {
  if (!value) {
    return undefined;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
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
