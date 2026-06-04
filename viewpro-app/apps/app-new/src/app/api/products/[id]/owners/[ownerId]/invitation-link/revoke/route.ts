// Temporary BFF adapter: product-named frontend route maps owner invitation
// revocation to ViewPro backend property engagement owner invitations.

import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

type Params = { params: Promise<{ id: string; ownerId: string }> };

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id, ownerId } = await params;
    const response = await bffFetch(
      `/property-engagements/${encodeURIComponent(id)}/owners/${encodeURIComponent(ownerId)}/invitation-link/revoke`,
      { method: 'POST' }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo revocar la invitación.');
  }
}
