// Design B (D2): direct apiRequest to viewpro-api — no Next.js BFF route.
import { apiRequest } from '@/lib/api-client';
import { parsePayment, parseTenantPayments } from './schemas';
import type { Payment, RecordPaymentInput, RevenueSummary, TenantPayments } from './types';

/**
 * Payment history plus billing state for one tenant.
 *
 * Both arrive in one response on purpose: rendering a paid-through date from
 * one request beside a payment list from another would let the page show a
 * state that never existed.
 */
export async function getTenantPayments(tenantId: string): Promise<TenantPayments> {
  const raw = await apiRequest<unknown>(`/operators/tenants/${tenantId}/payments`);

  return parseTenantPayments(raw);
}

/**
 * Record a payment. Requires a fresh step-up: callers must route a
 * STEP_UP_REQUIRED failure through useStepUpGate and retry, never treat it as
 * a generic error and never as a logout.
 */
export async function recordPayment(
  tenantId: string,
  input: RecordPaymentInput
): Promise<Payment> {
  const raw = await apiRequest<unknown>(`/operators/tenants/${tenantId}/payments`, {
    method: 'POST',
    body: input
  });

  return parsePayment(raw);
}

/** Reverse a payment. OWNER-only server-side; the reason is mandatory. */
export async function reversePayment(paymentId: string, reason: string): Promise<Payment> {
  const raw = await apiRequest<unknown>(`/operators/payments/${paymentId}/reversal`, {
    method: 'POST',
    body: { reason }
  });

  return parsePayment(raw);
}

/**
 * Collected revenue by month plus the overdue tenant count.
 *
 * Readable by every operator role including ANALYST — the people who cannot
 * write money are the ones who reconcile it.
 */
export async function getRevenueSummary(): Promise<RevenueSummary> {
  return apiRequest<RevenueSummary>('/operators/revenue/summary');
}
