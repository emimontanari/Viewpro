// Temporary BFF adapter: product-named frontend route maps property image deletion to
// ViewPro backend property engagement images.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string; imageId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id, imageId } = await params;
    const response = await bffFetch(`/property-engagements/${id}/images/${imageId}`, {
      method: 'DELETE'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo eliminar la imagen de la propiedad.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
