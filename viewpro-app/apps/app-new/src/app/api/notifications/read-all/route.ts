import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

const FALLBACK_MESSAGE = 'No se pudo actualizar la notificación.';
const TIMEOUT_MESSAGE = 'Las notificaciones tardaron demasiado.';

export async function POST(_request: Request) {
  try {
    const response = await bffFetch('/notifications/read-all', {
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}
