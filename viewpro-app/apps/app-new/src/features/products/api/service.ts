// ============================================================
// Property Engagement Service — Temporary Product-Named Adapter
// ============================================================
// UI modules still live under features/products while `/dashboard/product` is
// migrated. These functions call same-origin Next.js BFF handlers at
// `/api/products`, which proxy to the NestJS `/property-engagements` backend.
// ============================================================

import type {
  Product,
  ProductByIdResponse,
  ProductFilters,
  ProductMutationPayload,
  ProductStatusMutationPayload,
  ProductsResponse,
  PropertyImage
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
