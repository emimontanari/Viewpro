// Temporary BFF adapter: product-named frontend route maps seller picker data to
// ViewPro backend property engagement assignable agents.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await bffFetch('/property-engagements/assignable-agents');
    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudieron cargar los vendedores disponibles.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
