import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

const FALLBACK_MESSAGE = 'No se pudo actualizar tu notificación.';
const TIMEOUT_MESSAGE = 'El portal propietario tardó demasiado.';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/owner/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}
