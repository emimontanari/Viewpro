import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const response = await bffFetch(`/property-engagements/${id}/agents/primary`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'PUT'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo actualizar el vendedor principal.');
  }
}
