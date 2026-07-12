// Temporary BFF adapter: product-named frontend route maps seller assignment to
// ViewPro backend property engagement agents.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const response = await bffFetch(`/property-engagements/${id}/agents`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo asignar el vendedor.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
