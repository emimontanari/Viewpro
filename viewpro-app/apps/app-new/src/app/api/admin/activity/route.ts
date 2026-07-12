import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const ACTIVITY_QUERY_KEYS = ['page', 'pageSize', 'tenantId'] as const;

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`/admin/activity${buildQuery(request, ACTIVITY_QUERY_KEYS)}`, {
      includeTenantHeader: false
    });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudo cargar la actividad admin.',
      'La actividad admin tardó demasiado.'
    );
  }
}

function buildQuery(request: NextRequest, allowedKeys: readonly string[]) {
  const searchParams = new URLSearchParams();

  allowedKeys.forEach((key) => {
    const value = request.nextUrl.searchParams.get(key);

    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}
