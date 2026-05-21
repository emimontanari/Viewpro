// Temporary BFF adapter: product-named frontend route maps archive actions to
// ViewPro backend property engagement lifecycle actions.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

type ArchiveProductBody = {
  reason?: unknown;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await readArchiveBody(request);
    const response = await bffFetch(`/property-engagements/${id}/archive`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo archivar la propiedad.');
  }
}

async function readArchiveBody(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as ArchiveProductBody;

  return typeof body.reason === 'string' ? { reason: body.reason } : {};
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
