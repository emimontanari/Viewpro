// D4 — both PATCH endpoints are typed `Promise<unknown>` on viewpro-api (opaque
// InmoView control-lane passthrough, may be an idempotency-replayed JsonValue).
// The FE validates the raw body with zod before any field is read; on failure a
// normalized ApiError-shaped error is thrown so the UI surfaces it consistently.
import { z } from 'zod';
import type { ApiError } from '@/lib/api-client';
import type { AdminTenantLimitsUpdateResponse, AdminTenantStatusUpdateResponse } from './types';

const limitsSchema = z.object({
  maxUsers: z.number().int().nullable(),
  maxActivePropertyEngagements: z.number().int().nullable(),
  maxDocumentsStorageMb: z.number().int().nullable()
});

// status/previousStatus validated as z.string() (defensive — the server column
// is a raw string) and surfaced through the TenantStatus union type at the type
// edge; an unexpected value renders via its raw label rather than throwing.
const statusResponseSchema = z.object({
  tenantId: z.string(),
  previousStatus: z.string(),
  status: z.string(),
  unchanged: z.boolean(),
  updatedAt: z.string()
});

const limitsResponseSchema = z.object({
  tenantId: z.string(),
  previousLimits: limitsSchema,
  limits: limitsSchema,
  unchanged: z.boolean(),
  updatedAt: z.string()
});

const PARSE_ERROR: ApiError = {
  status: 502,
  message: 'Respuesta inesperada del servidor.'
};

export function parseStatusResponse(raw: unknown): AdminTenantStatusUpdateResponse {
  const result = statusResponseSchema.safeParse(raw);

  if (!result.success) {
    throw PARSE_ERROR;
  }

  return result.data as AdminTenantStatusUpdateResponse;
}

export function parseLimitsResponse(raw: unknown): AdminTenantLimitsUpdateResponse {
  const result = limitsResponseSchema.safeParse(raw);

  if (!result.success) {
    throw PARSE_ERROR;
  }

  return result.data as AdminTenantLimitsUpdateResponse;
}
