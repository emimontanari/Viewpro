// Temporary BFF adapter: product-named frontend route maps manual owner invitation links
// to ViewPro backend property engagement owner invitations.

import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

type Params = { params: Promise<{ id: string; ownerId: string }> };

export async function POST(request: Request, { params }: Params) {
  void request;

  try {
    const { id, ownerId } = await params;
    const response = await bffFetch(
      `/property-engagements/${id}/owners/${ownerId}/invitation-link`,
      { method: 'POST' }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo generar el link de invitación.');
  }
}
