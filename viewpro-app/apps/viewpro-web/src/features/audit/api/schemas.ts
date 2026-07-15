// R4 — previousValue/newValue are loose JSON (display-only old→new trail);
// z.unknown() never throws on absent/malformed shapes. The FE validates the
// raw body with zod before any field is read; on failure a normalized
// ApiError-shaped error is thrown so the UI surfaces it consistently
// (mirrors features/tenants/api/schemas.ts PARSE_ERROR pattern).
import { z } from 'zod';
import type { ApiError } from '@/lib/api-client';
import type { AuditFeedResponse } from './types';

const actorSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string()
});

const itemSchema = z.object({
  id: z.string(),
  action: z.string(),
  tenantId: z.string(),
  actor: actorSchema,
  previousValue: z.unknown(),
  newValue: z.unknown(),
  occurredAt: z.string(),
  seqNo: z.number()
});

const feedSchema = z.object({
  total: z.number(),
  items: z.array(itemSchema)
});

const PARSE_ERROR: ApiError = {
  status: 502,
  message: 'Respuesta inesperada del servidor.'
};

export function parseAuditFeedResponse(raw: unknown): AuditFeedResponse {
  const result = feedSchema.safeParse(raw);

  if (!result.success) {
    throw PARSE_ERROR;
  }

  return result.data as AuditFeedResponse;
}
