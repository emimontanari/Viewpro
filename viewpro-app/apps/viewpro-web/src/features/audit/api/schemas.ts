// R4 — previousValue/newValue are loose JSON (display-only old→new trail);
// z.unknown() never throws on absent/malformed shapes. The FE validates the
// raw body with zod before any field is read; on failure a normalized
// ApiError-shaped error is thrown so the UI surfaces it consistently
// (mirrors features/tenants/api/schemas.ts PARSE_ERROR pattern).
import { z } from 'zod';
import type { ApiError } from '@/lib/api-client';
import type { AuditFeedResponse } from './types';

// A4 — the feed is heterogeneous: InmoView-outbox entries carry actor
// {id,type,label}; VIEWPRO_NATIVE operator-management entries carry actor
// {id,email} (no type/label). Both variants must parse — one native entry
// must NOT fail the whole feed. type/label/email are all optional.
const actorSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  label: z.string().optional(),
  email: z.string().optional()
});

// Present only on VIEWPRO_NATIVE operator actions (null for outbox entries).
const targetSchema = z.object({
  id: z.string(),
  email: z.string().optional()
});

const itemSchema = z.object({
  id: z.string(),
  action: z.string(),
  tenantId: z.string().nullable(),
  actor: actorSchema,
  target: targetSchema.nullable().optional(),
  previousValue: z.unknown(),
  newValue: z.unknown(),
  occurredAt: z.string(),
  seqNo: z.number().nullable(),
  source: z.string().optional()
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
