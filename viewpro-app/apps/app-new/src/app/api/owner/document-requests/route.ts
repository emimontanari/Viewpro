import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`/owner/document-requests${request.nextUrl.search}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudieron cargar los documentos.',
      'El portal propietario tardó demasiado.'
    );
  }
}
