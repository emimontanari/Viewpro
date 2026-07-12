import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

type Params = { params: Promise<{ id: string; movementId: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id, movementId } = await params;
    const response = await bffFetch(
      `/owner/engagements/${id}/movements/${movementId}/whatsapp-contact-click`,
      {
        method: 'POST'
      }
    );

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudo registrar el contacto por WhatsApp.',
      'El portal propietario tardó demasiado.'
    );
  }
}
