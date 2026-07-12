// Temporary BFF adapter: product-named frontend route maps seller removal to
// ViewPro backend property engagement agents.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string; agentId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, agentId } = await params;
    const response = await bffFetch(`/property-engagements/${id}/agents/${agentId}`, {
      method: 'DELETE'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo quitar el vendedor.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
