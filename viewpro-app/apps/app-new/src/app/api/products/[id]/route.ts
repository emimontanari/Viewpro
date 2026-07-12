// Temporary BFF adapter: the legacy frontend `/api/products/:id` path now maps
// to ViewPro backend property engagements.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/property-engagements/${id}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo cargar la propiedad.');
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const response = await bffFetch(`/property-engagements/${id}`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo editar la propiedad.');
  }
}

export async function DELETE() {
  return NextResponse.json(
    { message: 'La eliminación de propiedades todavía no está soportada por el backend.' },
    { status: 501 }
  );
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
