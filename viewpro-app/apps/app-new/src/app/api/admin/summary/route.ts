import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

export async function GET() {
  try {
    const response = await bffFetch('/admin/summary', { includeTenantHeader: false });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudo cargar el resumen admin.',
      'El resumen admin tardó demasiado.'
    );
  }
}
