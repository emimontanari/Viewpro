import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function PUT(_request: NextRequest, _context: Params) {
  return unsupportedUserMutationResponse();
}

export async function DELETE(_request: NextRequest, _context: Params) {
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
