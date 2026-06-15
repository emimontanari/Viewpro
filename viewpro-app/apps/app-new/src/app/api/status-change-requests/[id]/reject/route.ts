import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest } from 'next/server';
import * as z from 'zod';

const rejectStatusChangeRequestSchema = z.object({
  resolutionComment: z.string().min(1).max(1000)
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = rejectStatusChangeRequestSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      return Response.json(
        { statusCode: 400, message: messages, error: 'Bad Request' },
        { status: 400 }
      );
    }

    const response = await bffFetch(`/status-change-requests/${id}/reject`, {
      body: JSON.stringify(parsed.data),
      headers: { 'content-type': 'application/json' },
      method: 'PATCH'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo rechazar la solicitud.');
  }
}
