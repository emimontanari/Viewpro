// platform-payment-ledger — console-side types for the money ledger.
//
// `amountMinorUnits` is a string here for the same reason it is a string on
// the wire: a JSON number past Number.MAX_SAFE_INTEGER arrives already
// corrupted. Nothing in this feature may pass it through Number().

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'MERCADOPAGO_LINK' | 'OTHER';

export type PlanCode = 'BASICO' | 'PROFESIONAL' | 'EMPRESA';

export interface Payment {
  id: string;
  tenantId: string;
  /** Integer minor units as a string. Never parse with Number(). */
  amountMinorUnits: string;
  currency: string;
  method: string;
  plan: string;
  periodStart: string;
  periodEnd: string;
  receiptReference: string | null;
  note: string | null;
  recordedByOperatorId: string;
  recordedAt: string;
  reversalOfPaymentId: string | null;
  reversalReason: string | null;
  reversedByPaymentId: string | null;
  isReversed: boolean;
}

export interface TenantPayments {
  paidThroughAt: string | null;
  /** Days since paid-through, or null when the tenant is not overdue. */
  overdueDays: number | null;
  payments: Payment[];
}

export interface RecordPaymentInput {
  amountMinorUnits: string;
  currency?: string;
  method: PaymentMethod;
  plan: PlanCode;
  periodStart: string;
  periodEnd: string;
  receiptReference?: string;
  note?: string;
}

export interface TenantBilling {
  paidThroughAt: string | null;
  overdueDays: number | null;
}
