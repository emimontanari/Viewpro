import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/owner/engagements/${id}/whatsapp-contact-click`, {
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(
      error,
      'No se pudo registrar el contacto por WhatsApp.',
      'El portal propietario tardó demasiado.'
    );
  }
}
