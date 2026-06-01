import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

type Params = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { membershipId } = await params;
    const response = await bffFetch(`/team/members/${encodeURIComponent(membershipId)}/role`, {
      body: await request.text(),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo actualizar el rol.');
  }
}
