import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ tenantId: string }> };

type StatusBody = {
  status?: unknown;
};

const ALLOWED_STATUS_TARGETS = new Set(['ACTIVE', 'SUSPENDED']);

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as StatusBody;

    if (typeof body.status !== 'string' || !ALLOWED_STATUS_TARGETS.has(body.status)) {
      return NextResponse.json(
        { message: 'El estado admin solicitado no está permitido.' },
        { status: 400 }
      );
    }

    const response = await bffFetch(`/admin/tenants/${encodeURIComponent(tenantId)}/status`, {
      body: JSON.stringify({ status: body.status }),
      headers: { 'content-type': 'application/json' },
      includeTenantHeader: false,
      method: 'PATCH'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudo actualizar el estado del tenant.',
      'La actualización del tenant tardó demasiado.'
    );
  }
}
