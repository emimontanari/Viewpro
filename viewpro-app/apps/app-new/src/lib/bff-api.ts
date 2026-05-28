import { SELECTED_TENANT_COOKIE } from '@/lib/tenant-selection';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';

const DEFAULT_API_URL = 'http://localhost:3001/api';
const API_URL = trimTrailingSlash(process.env.BFF_API_URL ?? DEFAULT_API_URL);
const BFF_TIMEOUT_MS = 10_000;

export async function bffFetch(path: string, init: RequestInit = {}) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const outgoingHeaders = new Headers(init.headers);
  const cookieHeader = cookieStore.toString();
  const selectedTenantId =
    requestHeaders.get('x-tenant-id') ?? cookieStore.get(SELECTED_TENANT_COOKIE)?.value;

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
      ...init,
      cache: 'no-store',
      credentials: 'include',
      headers: outgoingHeaders,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function proxyJsonResponse(response: Response, successStatus = response.status) {
  const body = await response.json().catch(() => undefined);

  if (body === undefined) {
    return new NextResponse(null, { status: successStatus });
  }

  return NextResponse.json(body, { status: successStatus });
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
