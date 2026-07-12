import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

const ACTIVITY_FEED_PATH = '/analytics/activity-feed';

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`${ACTIVITY_FEED_PATH}${buildActivityQuery(request)}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo cargar el seguimiento.');
  }
}

function buildActivityQuery(request: NextRequest) {
  const incomingParams = request.nextUrl.searchParams;
  const backendParams = new URLSearchParams();

  appendSearchParam(backendParams, 'page', incomingParams.get('page'));
  appendSearchParam(backendParams, 'pageSize', incomingParams.get('pageSize'));
  appendSearchParam(backendParams, 'kind', normalizeActivityKind(incomingParams.get('kind')));
  appendSearchParam(backendParams, 'type', incomingParams.get('type'));
  appendSearchParam(backendParams, 'sellerId', incomingParams.get('sellerId'));
  appendSearchParam(backendParams, 'dateFrom', incomingParams.get('dateFrom'));
  appendSearchParam(backendParams, 'dateTo', incomingParams.get('dateTo'));

  const query = backendParams.toString();
  return query ? `?${query}` : '';
}

function appendSearchParam(searchParams: URLSearchParams, key: string, value: string | null) {
  if (!value) {
    return;
  }

  searchParams.set(key, value);
}

function normalizeActivityKind(kind: string | null) {
  return kind === 'all' ? null : kind;
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'El seguimiento tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
