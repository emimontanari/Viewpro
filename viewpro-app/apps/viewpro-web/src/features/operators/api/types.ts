/**
 * FE-owned types for the operator roster-management console
 * (platform-operator-management, A4, PR2).
 *
 * Source: OperatorsController (viewpro-api, `operators/manage`, PR1, merged)
 * — every route returns a strongly-typed OperatorSummary JSON body
 * (id/email/role/status/createdAt/updatedAt). Unlike tenants' PATCH
 * endpoints these are NOT an opaque InmoView control-lane passthrough, so no
 * zod response schema is needed (mirrors features/metrics/api's simpler
 * pattern rather than features/tenants/api's).
 */

import type { OperatorRole } from '@/lib/session';

export type { OperatorRole };

export type OperatorStatus = 'ACTIVE' | 'SUSPENDED';

// GET /operators/manage → OperatorSummary[] (apps/viewpro-api
// src/auth/repositories/operator.repository.ts — Omit<Operator, 'passwordHash'>)
export type OperatorListItem = {
  id: string;
  email: string;
  role: OperatorRole;
  status: OperatorStatus;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
};

// POST /operators/manage body (CreateOperatorDto — @MinLength(12) tempPassword)
export type CreateOperatorPayload = {
  email: string;
  role: OperatorRole;
  tempPassword: string;
};

// PATCH /operators/manage/:id/role body
export type UpdateOperatorRolePayload = { role: OperatorRole };

// PATCH /operators/manage/:id/status body
export type UpdateOperatorStatusPayload = { status: OperatorStatus };
