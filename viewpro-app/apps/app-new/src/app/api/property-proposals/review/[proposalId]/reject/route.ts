import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

type Params = { params: Promise<{ proposalId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { proposalId } = await params;
    const contentType = request.headers.get('content-type');
    const response = await bffFetch(`/property-proposals/review/${encodeURIComponent(proposalId)}/reject`, {
      body: await request.text(),
      headers: contentType ? { 'content-type': contentType } : {},
      method: 'POST'
    });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo rechazar la propuesta.');
  }
}
