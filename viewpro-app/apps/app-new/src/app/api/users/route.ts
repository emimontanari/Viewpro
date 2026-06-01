import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET(_request: NextRequest) {
  try {
    const response = await bffFetch('/team/members');
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo cargar el equipo.');
  }
}

export async function POST(_request: NextRequest) {
  return unsupportedUserMutationResponse();
}

function unsupportedUserMutationResponse() {
  return NextResponse.json(
    {
      message:
        'Direct user mutations are not supported. Use team member and invitation endpoints for team management.'
    },
    { status: 501 }
  );
}
