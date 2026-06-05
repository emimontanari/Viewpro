import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const TENANT_QUERY_KEYS = ['page', 'pageSize', 'status'] as const;

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`/admin/tenants${buildQuery(request, TENANT_QUERY_KEYS)}`, {
      includeTenantHeader: false
    });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudo cargar la lista de tenants.',
      'La lista de tenants tardó demasiado.'
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
