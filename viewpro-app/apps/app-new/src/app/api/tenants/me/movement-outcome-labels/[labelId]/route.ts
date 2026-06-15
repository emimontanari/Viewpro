import { bffFetch, proxyBffErrorResponse } from '@/lib/bff-api';
import { NextResponse } from 'next/server';

type Params = { params: Promise<{ labelId: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { labelId } = await params;
    const response = await bffFetch(`/tenants/me/movement-outcome-labels/${labelId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const body = await response.json().catch(() => undefined);
      return NextResponse.json(body ?? { message: 'No se pudo eliminar la etiqueta.' }, {
        status: response.status
      });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo eliminar la etiqueta.');
  }
}
