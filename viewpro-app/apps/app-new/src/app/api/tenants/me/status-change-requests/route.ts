import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.toString();
    const response = await bffFetch(
      `/tenants/me/status-change-requests${query ? `?${query}` : ''}`
    );
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo cargar la bandeja de solicitudes.');
  }
}
