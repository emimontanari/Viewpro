import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/status-change-requests/${id}/approve`, {
      method: 'PATCH'
    });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo aprobar la solicitud.');
  }
}
