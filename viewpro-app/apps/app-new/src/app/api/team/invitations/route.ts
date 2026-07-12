import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';

export async function GET() {
  try {
    const response = await bffFetch('/team/invitations', { method: 'GET' });
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudieron cargar las invitaciones.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const response = await bffFetch('/team/invitations', {
      body: await request.text(),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo crear la invitación.');
  }
}
