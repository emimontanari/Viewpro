// ============================================================
// Property Engagement Service — Temporary Product-Named Adapter
// ============================================================
// UI modules still live under features/products while `/dashboard/product` is
// migrated. These functions call same-origin Next.js BFF handlers at
// `/api/products`, which proxy to the NestJS `/property-engagements` backend.
// ============================================================

import type {
  AssignableProductAgentsResponse,
  CreateProductDocumentRequestPayload,
  LinkProductOwnerPayload,
  LinkProductOwnerResponse,
  Product,
  ProductAgentAssignmentPayload,
  ProductByIdResponse,
  ProductDocumentRequest,
  ProductDocumentRequestsResponse,
  ProductDocumentRequestStatus,
  ProductDocumentVersionUrlResponse,
  ProductFilters,
  ProductMovement,
  ProductMovementMutationPayload,
  ProductMutationPayload,
  ProductMovementsResponse,
  ProductStatusMutationPayload,
  ProductsResponse,
  PropertyImage,
  RejectProductDocumentRequestPayload,
  RemoveProductAgentResponse
} from './types';

const DEFAULT_APP_URL = 'http://localhost:3000';
const PRODUCTS_API_PATH = '/api/products';
const PRODUCT_REQUEST_TIMEOUT_MS = 10_000;
const APP_URL = trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);

export async function getProducts(filters: ProductFilters): Promise<ProductsResponse> {
  const response = await apiFetch(buildProductsUrl(filters));
  return parseJsonResponse<ProductsResponse>(response);
}

export async function getProductById(id: string): Promise<ProductByIdResponse> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${id}`);
  return parseJsonResponse<ProductByIdResponse>(response, { allowedErrorStatuses: [404] });
}

export async function getProductMovements(productId: string): Promise<ProductMovementsResponse> {
  const response = await apiFetch(
    `${PRODUCTS_API_PATH}/${productId}/movements?pageSize=8&order=desc`
  );
  return parseJsonResponse<ProductMovementsResponse>(response);
}

export async function getProductDocumentRequests(
  productId: string,
  params: { page?: number; pageSize?: number; status?: ProductDocumentRequestStatus } = {}
): Promise<ProductDocumentRequestsResponse> {
  const searchParams = new URLSearchParams();
  appendSearchParam(searchParams, 'page', params.page);
  appendSearchParam(searchParams, 'pageSize', params.pageSize);
  appendSearchParam(searchParams, 'status', params.status);

  const query = searchParams.toString();
  const response = await apiFetch(
    `${PRODUCTS_API_PATH}/${productId}/document-requests${query ? `?${query}` : ''}`
  );
  return parseJsonResponse<ProductDocumentRequestsResponse>(response);
}

export async function createProductDocumentRequest(
  productId: string,
  data: CreateProductDocumentRequestPayload
): Promise<ProductDocumentRequest> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/document-requests`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<ProductDocumentRequest>(response);
}

export async function createProductDocumentReadUrl(
  versionId: string
): Promise<ProductDocumentVersionUrlResponse> {
  const response = await apiFetch(`/api/document-versions/${versionId}/read-url`, {
    method: 'POST'
  });

  return parseJsonResponse<ProductDocumentVersionUrlResponse>(response);
}

export async function approveProductDocumentRequest(
  requestId: string
): Promise<ProductDocumentRequest> {
  const response = await apiFetch(`/api/document-requests/${requestId}/approve`, {
    method: 'POST'
  });

  return parseJsonResponse<ProductDocumentRequest>(response);
}

export async function rejectProductDocumentRequest(
  requestId: string,
  data: RejectProductDocumentRequestPayload
): Promise<ProductDocumentRequest> {
  const response = await apiFetch(`/api/document-requests/${requestId}/reject`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<ProductDocumentRequest>(response);
}

export async function getAssignableProductAgents(): Promise<AssignableProductAgentsResponse> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/assignable-agents`);
  return parseJsonResponse<AssignableProductAgentsResponse>(response);
}

export async function assignProductAgent(
  productId: string,
  data: ProductAgentAssignmentPayload
): Promise<unknown> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/agents`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<unknown>(response);
}

export async function removeProductAgent(
  productId: string,
  agentId: string
): Promise<RemoveProductAgentResponse> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/agents/${agentId}`, {
    method: 'DELETE'
  });

  return parseJsonResponse<RemoveProductAgentResponse>(response);
}

export async function linkProductOwner(
  productId: string,
  data: LinkProductOwnerPayload
): Promise<LinkProductOwnerResponse> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/owners`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<LinkProductOwnerResponse>(response);
}

export async function createProductMovement(
  productId: string,
  data: ProductMovementMutationPayload
): Promise<ProductMovement> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/movements`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<ProductMovement>(response);
}

export async function createProduct(data: ProductMutationPayload): Promise<Product> {
  const response = await apiFetch(PRODUCTS_API_PATH, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<Product>(response);
}

export async function uploadProductImage(productId: string, image: File): Promise<PropertyImage> {
  const formData = new FormData();
  formData.set('image', image);

  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/images`, {
    body: formData,
    method: 'POST'
  });

  return parseJsonResponse<PropertyImage>(response);
}

export async function deleteProductImage(productId: string, imageId: string) {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/images/${imageId}`, {
    method: 'DELETE'
  });

  return parseJsonResponse(response);
}

export async function setProductImageAsPrimary(
  productId: string,
  imageId: string
): Promise<PropertyImage> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${productId}/images/${imageId}/primary`, {
    method: 'PATCH'
  });

  return parseJsonResponse<PropertyImage>(response);
}

export async function updateProduct(id: string, data: ProductMutationPayload): Promise<Product> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${id}`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'PUT'
  });

  return parseJsonResponse<Product>(response);
}

export async function updateProductStatus(id: string, data: ProductStatusMutationPayload) {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${id}/status`, {
    body: JSON.stringify(data),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse(response);
}

export async function archiveProduct(id: string, reason?: string): Promise<Product> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${id}/archive`, {
    body: JSON.stringify(reason === undefined ? {} : { reason }),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  });

  return parseJsonResponse<Product>(response);
}

export async function restoreProduct(id: string): Promise<Product> {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${id}/restore`, {
    method: 'POST'
  });

  return parseJsonResponse<Product>(response);
}

export async function deleteProduct(id: string) {
  const response = await apiFetch(`${PRODUCTS_API_PATH}/${id}`, {
    method: 'DELETE'
  });

  return parseJsonResponse(response);
}

function buildProductsUrl(filters: ProductFilters) {
  const searchParams = new URLSearchParams();

  appendSearchParam(searchParams, 'page', filters.page);
  appendSearchParam(searchParams, 'limit', filters.limit);
  appendSearchParam(searchParams, 'operationType', filters.operationType);
  appendSearchParam(searchParams, 'status', filters.status);
  appendSearchParam(searchParams, 'archived', filters.archived);

  const query = searchParams.toString();
  return query ? `${PRODUCTS_API_PATH}?${query}` : PRODUCTS_API_PATH;
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
  const timeoutId = setTimeout(() => controller.abort(), PRODUCT_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(getFetchUrl(path), {
      cache: 'no-store',
      credentials: 'include',
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('La solicitud de propiedades tardó demasiado.', { cause: error });
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

async function parseJsonResponse<TResponse>(
  response: Response,
  options: { allowedErrorStatuses?: number[] } = {}
): Promise<TResponse> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok && !options.allowedErrorStatuses?.includes(response.status)) {
    throw new Error(getErrorMessage(body, response.statusText));
  }

  return body as TResponse;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
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

  return fallback || 'La solicitud de propiedades falló.';
}
