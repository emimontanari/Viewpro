import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';

type Params = { params: Promise<{ tenantId: string }> };

type LimitsBody = {
  maxUsers?: unknown;
  maxActivePropertyEngagements?: unknown;
  maxDocumentsStorageMb?: unknown;
};

const LIMIT_KEYS = ['maxUsers', 'maxActivePropertyEngagements', 'maxDocumentsStorageMb'] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { tenantId } = await params;
    const body = (await request.json().catch(() => ({}))) as LimitsBody;

    if (!isValidLimitsBody(body)) {
      return NextResponse.json(
        { message: 'Los límites admin solicitados no son válidos.' },
        { status: 400 }
      );
    }

    const response = await bffFetch(`/admin/tenants/${encodeURIComponent(tenantId)}/limits`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      includeTenantHeader: false,
      method: 'PATCH'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudieron actualizar los límites del tenant.',
      'La actualización de límites tardó demasiado.'
    );
  }
}

function isValidLimitsBody(body: LimitsBody) {
  return LIMIT_KEYS.every((key) => isValidLimitValue(body[key]));
}

function isValidLimitValue(value: unknown) {
  return value === null || (Number.isInteger(value) && Number(value) >= 0);
}
