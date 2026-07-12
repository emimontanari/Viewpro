import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const FALLBACK_MESSAGE = 'No se pudieron cargar tus notificaciones.';
const TIMEOUT_MESSAGE = 'El portal propietario tardó demasiado.';

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(
      `/owner/notifications${buildOwnerNotificationsQuery(request.nextUrl)}`
    );
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}

function buildOwnerNotificationsQuery(url: URL) {
  const searchParams = new URLSearchParams();
  const page = parsePositiveInt(url.searchParams.get('page'));
  const pageSize = parseBoundedInt(url.searchParams.get('pageSize'), 1, 50);
  const unreadOnly = parseBoolean(url.searchParams.get('unreadOnly'));

  if (page !== null) {
    searchParams.set('page', String(page));
  }

  if (pageSize !== null) {
    searchParams.set('pageSize', String(pageSize));
  }

  if (unreadOnly !== null) {
    searchParams.set('unreadOnly', String(unreadOnly));
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

function parsePositiveInt(value: string | null) {
  return parseBoundedInt(value, 1);
}

function parseBoundedInt(value: string | null, min: number, max?: number) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
    return null;
  }

  return parsed;
}

function parseBoolean(value: string | null) {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
}
