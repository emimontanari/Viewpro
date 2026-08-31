import { SELECTED_TENANT_COOKIE } from '@/lib/tenant-selection';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

const DEFAULT_API_URL = 'http://localhost:3001/api';
const API_URL = trimTrailingSlash(process.env.BFF_API_URL ?? DEFAULT_API_URL);
const BFF_TIMEOUT_MS = 10_000;

type BffFetchOptions = RequestInit & {
  includeTenantHeader?: boolean;
};

export async function bffFetch(path: string, init: BffFetchOptions = {}) {
  const { includeTenantHeader = true, ...requestInit } = init;
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const outgoingHeaders = new Headers(requestInit.headers);
  const cookieHeader = cookieStore.toString();
  const selectedTenantId = includeTenantHeader
    ? (requestHeaders.get('x-tenant-id') ?? cookieStore.get(SELECTED_TENANT_COOKIE)?.value)
    : null;

  if (cookieHeader) {
    outgoingHeaders.set('cookie', cookieHeader);
  }

  if (selectedTenantId && !outgoingHeaders.has('x-tenant-id')) {
    outgoingHeaders.set('x-tenant-id', selectedTenantId);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BFF_TIMEOUT_MS);

  try {
    return await fetch(`${API_URL}${normalizePath(path)}`, {
      ...requestInit,
      cache: 'no-store',
      credentials: 'include',
      headers: outgoingHeaders,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

const CANONICAL_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function proxyJsonResponse(response: Response, successStatus = response.status) {
  const body = await response.json().catch(() => undefined);
  const headers = new Headers();
  const requestId = response.headers.get('x-request-id');

  if (requestId && CANONICAL_UUID_V4.test(requestId)) {
    headers.set('x-request-id', requestId);
  }

  if (body === undefined) {
    return new NextResponse(null, { headers, status: successStatus });
  }

  return NextResponse.json(body, { headers, status: successStatus });
}

export function proxyBffErrorResponse(
  error: unknown,
  fallbackMessage: string,
  timeoutMessage = 'La operación tardó demasiado.'
) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? timeoutMessage : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
