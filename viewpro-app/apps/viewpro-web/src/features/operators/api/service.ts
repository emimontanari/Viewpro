// Design B (D2): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import type {
  CreateOperatorPayload,
  OperatorListItem,
  UpdateOperatorRolePayload,
  UpdateOperatorStatusPayload
} from './types';

/**
 * Fetch the full operator roster from viewpro-api.
 *
 * Endpoint: GET /operators/manage
 * Auth: viewpro_platform_access_token cookie (credentials:include set by
 * apiRequest). OWNER-only — a non-OWNER session gets a 403 PERMISSION_DENIED.
 * No pagination — the roster is expected to stay small (operator accounts,
 * not tenant-scoped data).
 */
export async function getOperatorList(): Promise<OperatorListItem[]> {
  return apiRequest<OperatorListItem[]>('/operators/manage');
}

/**
 * POST /operators/manage — create a new operator with an OWNER-chosen role
 * and OWNER-provided temp password (Design Decision 5: no forced rotation).
 * Requires step-up. Throws a 409 (code DUPLICATE_EMAIL) if the email exists.
 */
export async function createOperator(payload: CreateOperatorPayload): Promise<OperatorListItem> {
  return apiRequest<OperatorListItem>('/operators/manage', {
    method: 'POST',
    body: payload
  });
}

/**
 * PATCH /operators/manage/:id/role — requires step-up. Throws a 422
 * (SELF_DEMOTE_FORBIDDEN or LAST_OWNER_PROTECTED) on a guardrail violation.
 */
export async function updateOperatorRole(
  operatorId: string,
  payload: UpdateOperatorRolePayload
): Promise<OperatorListItem> {
  return apiRequest<OperatorListItem>(`/operators/manage/${encodeURIComponent(operatorId)}/role`, {
    method: 'PATCH',
    body: payload
  });
}

/**
 * PATCH /operators/manage/:id/status — requires step-up on every mutation,
 * including reactivate (intentional divergence from the tenant-status
 * pattern, per design). Throws a 422 (SELF_STATUS_CHANGE_FORBIDDEN or
 * LAST_OWNER_PROTECTED) on a guardrail violation.
 */
export async function updateOperatorStatus(
  operatorId: string,
  payload: UpdateOperatorStatusPayload
): Promise<OperatorListItem> {
  return apiRequest<OperatorListItem>(`/operators/manage/${encodeURIComponent(operatorId)}/status`, {
    method: 'PATCH',
    body: payload
  });
}
