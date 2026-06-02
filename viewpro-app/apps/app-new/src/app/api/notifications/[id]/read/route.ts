import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

const FALLBACK_MESSAGE = 'No se pudo actualizar la notificación.';
const TIMEOUT_MESSAGE = 'Las notificaciones tardaron demasiado.';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}
