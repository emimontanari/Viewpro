// Temporary BFF adapter: product-named frontend route maps quick status changes to
// ViewPro backend property engagement movements so timeline/analytics stay intact.

import { bffFetch, proxyJsonResponse } from '@/lib/bff-api';
import { propertyStatusOptions } from '@/features/products/constants/product-options';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

type StatusChangeBody = {
  previousStatus?: string;
  status?: string;
};

const statusLabels = Object.fromEntries(
  propertyStatusOptions.map((option) => [option.value, option.label])
) as Record<string, string>;

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as StatusChangeBody;

    if (!body.status) {
      return NextResponse.json({ message: 'El nuevo estado es obligatorio.' }, { status: 400 });
    }

    const response = await bffFetch(`/property-engagements/${id}/movements`, {
      body: JSON.stringify({
        type: 'STATUS_CHANGE',
        observation: buildStatusObservation(body.previousStatus, body.status),
        newStatus: body.status
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return toBffErrorResponse(error, 'No se pudo cambiar el estado de la propiedad.');
  }
}

function buildStatusObservation(previousStatus: string | undefined, nextStatus: string) {
  const previousLabel = previousStatus
    ? (statusLabels[previousStatus] ?? previousStatus)
    : 'Sin estado anterior';
  const nextLabel = statusLabels[nextStatus] ?? nextStatus;

  return `Cambio rápido de estado: ${previousLabel} → ${nextLabel}`;
}

function toBffErrorResponse(error: unknown, fallbackMessage: string) {
  const isTimeout = error instanceof Error && error.name === 'AbortError';
  return NextResponse.json(
    { message: isTimeout ? 'La solicitud al backend tardó demasiado.' : fallbackMessage },
    { status: isTimeout ? 504 : 502 }
  );
}
