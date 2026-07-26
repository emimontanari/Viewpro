import { z } from 'zod';
import type { ApiError } from '@/lib/api-client';
import type { Payment, TenantPayments } from './types';

// platform-payment-ledger — the amount is validated as a STRING of digits.
// Declaring it z.number() would make zod coerce and round anything past
// Number.MAX_SAFE_INTEGER, defeating the whole reason it travels as a string.
const paymentSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  amountMinorUnits: z.string().regex(/^\d+$/),
  currency: z.string(),
  method: z.string(),
  plan: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  receiptReference: z.string().nullable(),
  note: z.string().nullable(),
  recordedByOperatorId: z.string(),
  recordedAt: z.string(),
  reversalOfPaymentId: z.string().nullable(),
  reversalReason: z.string().nullable(),
  reversedByPaymentId: z.string().nullable(),
  isReversed: z.boolean()
});

const tenantPaymentsSchema = z.object({
  paidThroughAt: z.string().nullable(),
  overdueDays: z.number().int().nullable(),
  payments: z.array(paymentSchema)
});

const PARSE_ERROR: ApiError = {
  status: 502,
  message: 'Respuesta inesperada del servidor.'
};

export function parseTenantPayments(raw: unknown): TenantPayments {
  const result = tenantPaymentsSchema.safeParse(raw);

  if (!result.success) {
    throw PARSE_ERROR;
  }

  return result.data;
}

export function parsePayment(raw: unknown): Payment {
  const result = paymentSchema.safeParse(raw);

  if (!result.success) {
    throw PARSE_ERROR;
  }

  return result.data;
}
