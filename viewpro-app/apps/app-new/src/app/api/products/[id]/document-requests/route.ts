// Temporary BFF adapter: product-named frontend route maps document requests to
// ViewPro backend property engagement document requests.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const searchParams = new URLSearchParams(request.nextUrl.searchParams);
    searchParams.set('propertyEngagementId', id);

    const query = searchParams.toString();
    const response = await bffFetch(`/document-requests${query ? `?${query}` : ''}`);

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudieron cargar los documentos de la propiedad.');
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const response = await bffFetch(`/property-engagements/${id}/document-requests`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo solicitar el documento.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
