import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

type Params = { params: Promise<{ proposalId: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { proposalId } = await params;
    const response = await bffFetch(`/property-proposals/${encodeURIComponent(proposalId)}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo cargar la propuesta.');
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { proposalId } = await params;
    const contentType = request.headers.get('content-type');
    const response = await bffFetch(`/property-proposals/${encodeURIComponent(proposalId)}`, {
      body: await request.text(),
      headers: contentType ? { 'content-type': contentType } : {},
      method: 'PATCH'
    });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo actualizar la propuesta.');
  }
}
