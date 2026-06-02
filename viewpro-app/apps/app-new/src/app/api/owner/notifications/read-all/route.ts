import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

const FALLBACK_MESSAGE = 'No se pudo actualizar tu notificación.';
const TIMEOUT_MESSAGE = 'El portal propietario tardó demasiado.';

export async function POST(_request: Request) {
  try {
    const response = await bffFetch('/owner/notifications/read-all', {
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}
