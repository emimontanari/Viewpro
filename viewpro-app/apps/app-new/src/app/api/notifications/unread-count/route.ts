import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const FALLBACK_MESSAGE = 'No se pudieron cargar las notificaciones.';
const TIMEOUT_MESSAGE = 'Las notificaciones tardaron demasiado.';

export async function GET(_request: NextRequest) {
  try {
    const response = await bffFetch('/notifications/unread-count');
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, FALLBACK_MESSAGE, TIMEOUT_MESSAGE);
  }
}
