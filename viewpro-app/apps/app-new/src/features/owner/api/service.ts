import { bffRequest } from '@/lib/bff-client';
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
const DOCUMENT_UPLOAD_FAILED_MESSAGE = 'No se pudo subir el documento.';
const FAKE_DOCUMENT_STORAGE_HOST = 'fake-documents.local';
const FAKE_DOCUMENT_STORAGE_MESSAGE =
  'La API está usando almacenamiento documental fake. Para subir o abrir documentos desde el navegador, reiniciá la API con DOCUMENT_STORAGE_DRIVER=local y API_PUBLIC_URL=http://localhost:3001.';
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

function ownerRequest<TResponse>(path: string, init: RequestInit = {}): Promise<TResponse> {
  return bffRequest<TResponse>(path, init, { timeoutMs: OWNER_REQUEST_TIMEOUT_MS });
}

export async function getOwnerProperties(): Promise<OwnerPropertiesResponse> {
  return ownerRequest<OwnerPropertiesResponse>(`${OWNER_API_PATH}/properties`);
}

export async function getOwnerProperty(id: string): Promise<OwnerProperty> {
  return ownerRequest<OwnerProperty>(`${OWNER_API_PATH}/properties/${id}`);
}

export async function getOwnerPropertyEngagements(id: string): Promise<OwnerEngagementsResponse> {
  return ownerRequest<OwnerEngagementsResponse>(`${OWNER_API_PATH}/properties/${id}/engagements`);
}

export async function getOwnerEngagementTimeline(
  id: string,
  filters: OwnerTimelineFilters = {}
): Promise<OwnerTimelineResponse> {
  return ownerRequest<OwnerTimelineResponse>(
    `${OWNER_API_PATH}/engagements/${id}/timeline${buildTimelineQuery(filters)}`
  );
}

export async function trackOwnerWhatsappContactClick(engagementId: string): Promise<void> {
  await ownerRequest<void>(
    `${OWNER_API_PATH}/engagements/${engagementId}/whatsapp-contact-click`,
    {
      keepalive: true,
      method: 'POST'
    }
  );
}

export async function trackOwnerMovementWhatsappContactClick(
  engagementId: string,
  movementId: string
): Promise<void> {
  await ownerRequest<void>(
    `${OWNER_API_PATH}/engagements/${engagementId}/movements/${movementId}/whatsapp-contact-click`,
    {
      keepalive: true,
      method: 'POST'
    }
  );
}

export async function getOwnerDocumentRequests(
  filters: OwnerDocumentRequestsFilters = {}
): Promise<OwnerDocumentRequestsResponse> {
  return ownerRequest<OwnerDocumentRequestsResponse>(
    `${OWNER_API_PATH}/document-requests${buildDocumentRequestsQuery(filters)}`
  );
}

export async function createOwnerDocumentUploadUrl(
  requestId: string,
  payload: CreateOwnerDocumentUploadUrlPayload
): Promise<CreateOwnerDocumentUploadUrlResponse> {
  return ownerRequest<CreateOwnerDocumentUploadUrlResponse>(
    `${OWNER_API_PATH}/document-requests/${requestId}/upload-url`,
    {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    }
  );
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
  return ownerRequest<OwnerDocumentVersion>(
    `${OWNER_API_PATH}/document-versions/${versionId}/confirm-upload`,
    { method: 'POST' }
  );
}

export async function createOwnerDocumentReadUrl(
  versionId: string
): Promise<OwnerDocumentVersionUrlResponse> {
  const body = await ownerRequest<OwnerDocumentVersionUrlResponse>(
    `${OWNER_API_PATH}/document-versions/${versionId}/read-url`,
    { method: 'POST' }
  );

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

    attachEventListener<ProgressEvent>(xhr.upload, 'progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        options.onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percent: Math.min(100, Math.round((event.loaded / event.total) * 100))
        });
        return;
      }

      options.onProgress?.({ loaded: event.loaded, total: 0, percent: 35 });
    });

    attachEventListener(xhr, 'error', () => reject(new Error(DOCUMENT_UPLOAD_FAILED_MESSAGE)));
    attachEventListener(xhr, 'timeout', () =>
      reject(new Error('La carga del documento tardó demasiado.'))
    );
    attachEventListener(xhr, 'load', () => {
      const body = parseJson(xhr.responseText);

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(DOCUMENT_UPLOAD_FAILED_MESSAGE));
        return;
      }

      resolve(
        (body as OwnerDocumentUploadResponse | undefined) ?? {
          storageKey: uploadUrl.storageKey,
          sizeBytes: fileOrBlob.size,
          mimeType
        }
      );
    });

    xhr.send(fileOrBlob);
  });
}

function attachEventListener<TEvent extends Event = Event>(
  target: EventTarget | Record<string, unknown>,
  type: string,
  listener: (event: TEvent) => void
) {
  if ('addEventListener' in target && typeof target.addEventListener === 'function') {
    target.addEventListener(type, listener as EventListener);
    return;
  }

  (target as Record<string, unknown>)[`on${type}`] = listener;
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

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
