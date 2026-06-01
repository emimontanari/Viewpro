import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

type Params = { params: Promise<{ membershipId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { membershipId } = await params;
    const response = await bffFetch(
      `/team/members/${encodeURIComponent(membershipId)}/deactivate`,
      { method: 'POST' }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo desactivar el acceso.');
  }
}
