import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

const FEEDBACK_PATH = '/feedback';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await bffFetch(FEEDBACK_PATH, {
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo enviar el comentario.');
  }
}
