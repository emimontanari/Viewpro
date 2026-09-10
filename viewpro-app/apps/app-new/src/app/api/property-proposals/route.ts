import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const PROPERTY_PROPOSALS_PATH = '/property-proposals';

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`${PROPERTY_PROPOSALS_PATH}${request.nextUrl.search}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudieron cargar las propuestas.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const response = await bffFetch(PROPERTY_PROPOSALS_PATH, {
      body: await request.text(),
      headers: { 'content-type': request.headers.get('content-type') ?? 'application/json' },
      method: 'POST'
    });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo crear la propuesta.');
  }
}
