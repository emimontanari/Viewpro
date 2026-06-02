import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const FALLBACK_MESSAGE = 'No se pudieron cargar tus notificaciones.';
const TIMEOUT_MESSAGE = 'El portal propietario tardó demasiado.';

export async function GET(_request: NextRequest) {
  try {
    const response = await bffFetch('/owner/notifications/unread-count');
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}
