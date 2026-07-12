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
        'Direct user mutations are not supported. Use team member and invitation endpoints for team management.'
    },
    { status: 501 }
  );
}
