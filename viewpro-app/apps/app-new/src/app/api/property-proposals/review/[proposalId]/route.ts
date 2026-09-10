import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

type Params = { params: Promise<{ proposalId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { proposalId } = await params;
    const response = await bffFetch(`/property-proposals/review/${encodeURIComponent(proposalId)}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo cargar la propuesta para revisión.');
  }
}
