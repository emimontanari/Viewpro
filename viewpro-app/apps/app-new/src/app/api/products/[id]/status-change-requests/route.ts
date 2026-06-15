import { bffFetch, proxyBffErrorResponse, proxyJsonResponse } from '@/lib/bff-api';
import { type NextRequest } from 'next/server';
import * as z from 'zod';

const PROPERTY_ENGAGEMENT_STATUSES = [
  'CAPTURE',
  'DOCUMENTATION_PENDING',
  'PUBLICATION_PREPARATION',
  'ACTIVE_PUBLICATION',
  'INQUIRIES_AND_VISITS',
  'OFFER_NEGOTIATION',
  'RESERVATION_STARTED',
  'FINAL_DOCUMENTATION',
  'CLOSED',
  'CANCELLED'
] as const;

const createStatusChangeRequestSchema = z.object({
  targetStatus: z.enum(PROPERTY_ENGAGEMENT_STATUSES),
  currentStatusSnapshot: z.enum(PROPERTY_ENGAGEMENT_STATUSES),
  requestNote: z.string().max(1000).optional()
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const response = await bffFetch(`/property-engagements/${id}/status-change-requests`);
    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudieron cargar las solicitudes de cambio de estado.');
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = createStatusChangeRequestSchema.safeParse(body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      return Response.json(
        { statusCode: 400, message: messages, error: 'Bad Request' },
        { status: 400 }
      );
    }

    const response = await bffFetch(`/property-engagements/${id}/status-change-requests`, {
      body: JSON.stringify(parsed.data),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });

    return proxyJsonResponse(response);
  } catch (error) {
    return proxyBffErrorResponse(error, 'No se pudo crear la solicitud de cambio de estado.');
  }
}
