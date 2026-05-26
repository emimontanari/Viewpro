import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/owner/properties/${id}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return toOwnerBffErrorResponse(error, 'No se pudo cargar la propiedad.');
  }
}

function toOwnerBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'El portal propietario tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
