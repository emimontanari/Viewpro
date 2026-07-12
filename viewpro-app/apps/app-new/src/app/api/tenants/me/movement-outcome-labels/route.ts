import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest, NextResponse } from 'next/server';
import * as z from 'zod';
import { labelColorSchema } from '@/features/products/schemas/movement';

const createLabelSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'El nombre de la etiqueta es obligatorio.')
    .max(40, 'El nombre no puede superar 40 caracteres.'),
  color: labelColorSchema.optional()
});

export async function GET(request: NextRequest) {
  try {
    const activeOnly = request.nextUrl.searchParams.get('activeOnly');
    const query = activeOnly !== null ? `?activeOnly=${activeOnly}` : '';
    const response = await bffFetch(`/tenants/me/movement-outcome-labels${query}`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudieron cargar las etiquetas.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = createLabelSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      return NextResponse.json(
        { statusCode: 400, message: messages, error: 'Bad Request' },
        { status: 400 }
      );
    }

    const response = await bffFetch('/tenants/me/movement-outcome-labels', {
      body: JSON.stringify(parsed.data),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo crear la etiqueta.');
  }
}
