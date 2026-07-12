import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';

const updateWhatsappPhoneSchema = z.object({
  whatsappPhone: z.string().nullable()
});

export async function GET() {
  try {
    const response = await bffFetch('/tenants/me/whatsapp-phone');
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo cargar el teléfono de WhatsApp.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateWhatsappPhoneSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      return NextResponse.json(
        { statusCode: 400, message: messages, error: 'Bad Request' },
        { status: 400 }
      );
    }

    const response = await bffFetch('/tenants/me/whatsapp-phone', {
      body: JSON.stringify(parsed.data),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo actualizar el teléfono de WhatsApp.');
  }
}
