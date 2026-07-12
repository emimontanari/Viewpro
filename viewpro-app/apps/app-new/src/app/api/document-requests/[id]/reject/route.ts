import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const response = await bffFetch(`/document-requests/${id}/reject`, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo rechazar el documento.');
  }
}
