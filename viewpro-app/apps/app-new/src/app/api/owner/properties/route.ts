import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await bffFetch('/owner/properties');
    return proxyJsonResponse(response);
  } catch (error) {
    return toOwnerBffErrorResponse(error, 'No se pudieron cargar tus propiedades.');
  }
}

function toOwnerBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'El portal propietario tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
