import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/owner/engagements/${id}/timeline${request.nextUrl.search}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return toOwnerBffErrorResponse(error, 'No se pudo cargar el seguimiento del propietario.');
  }
}

function toOwnerBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'El portal propietario tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
