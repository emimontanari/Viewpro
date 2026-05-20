// Temporary BFF adapter: the legacy frontend `/api/products` path now maps to
// ViewPro backend property engagements.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

const PROPERTY_ENGAGEMENTS_PATH = '/property-engagements';

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`${PROPERTY_ENGAGEMENTS_PATH}${buildListQuery(request)}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudieron cargar las propiedades.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const response = await bffFetch(PROPERTY_ENGAGEMENTS_PATH, {
      body,
      headers: {
        'content-type': request.headers.get('content-type') ?? 'application/json'
      },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo crear la propiedad.');
  }
}

function buildListQuery(request: NextRequest) {
  const incomingParams = request.nextUrl.searchParams;
  const backendParams = new URLSearchParams();

  appendSearchParam(backendParams, 'page', incomingParams.get('page'));
  appendSearchParam(
    backendParams,
    'pageSize',
    incomingParams.get('limit') ?? incomingParams.get('pageSize') ?? incomingParams.get('perPage')
  );
  appendSearchParam(backendParams, 'status', incomingParams.get('status'));
  appendSearchParam(
    backendParams,
    'operationType',
    incomingParams.get('operationType') ?? incomingParams.get('categories')
  );

  const query = backendParams.toString();
  return query ? `?${query}` : '';
}

function appendSearchParam(searchParams: URLSearchParams, key: string, value: string | null) {
  if (!value) {
    return;
  }

  searchParams.set(key, value);
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
