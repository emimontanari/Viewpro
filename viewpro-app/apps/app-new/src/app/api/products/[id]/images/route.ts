// Temporary BFF adapter: product-named frontend route maps property images to
// ViewPro backend property engagement images.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const response = await bffFetch(`/property-engagements/${id}/images`, {
      body: formData,
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo subir la imagen de la propiedad.');
  }
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
