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
        'User mutations are not supported yet. Team invitations and role changes are planned for a later Stage 22 slice.'
    },
    { status: 501 }
  );
}
