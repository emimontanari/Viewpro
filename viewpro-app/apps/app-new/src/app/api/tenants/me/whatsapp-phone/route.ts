import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';

/**
 * Transport shape only — deliberately permissive (#287 WU4, design.md
 * ADR-6). The phone is mandatory now and `null` is rejected, but that rule
 * is enforced exclusively by the API use case via `parseArContactPhone`,
 * which answers with `phone.required` / `phone.invalid` /
 * `phone.country_unsupported`. Tightening this schema to `z.string()` would
 * make this route 400 locally with no `errorCode`, swallowing
 * `phone.required` before it ever reaches the API — a third rule on one
 * column, exactly what ADR-6 exists to prevent.
 */
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
