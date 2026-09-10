import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

const PROPERTY_PROPOSAL_REVIEWS_PATH = '/property-proposals/review';

export async function GET(request: NextRequest) {
  try {
    const response = await bffFetch(`${PROPERTY_PROPOSAL_REVIEWS_PATH}${request.nextUrl.search}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudieron cargar las propuestas para revisión.');
  }
}
