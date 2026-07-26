'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import type { TenantBilling } from '@/features/payments/api/types';
import { overdueLabel } from './money-format';

type Props = {
  /** Optional so the list survives an API deployed before this slice. */
  billing?: TenantBilling;
  testId?: string;
};

/**
 * BillingCell — paid-through date, or an overdue badge.
 *
 * This cell is the compensating control for the "warn, don't cut" decision:
 * because nothing suspends a lapsed tenant automatically, this is the ONLY
 * place an operator finds out that someone stopped paying. Rendering nothing
 * here would mean the decision has no safety net at all.
 *
 * A tenant nobody ever charged reads "Sin pagos", not an empty cell — blank
 * reads as loading or broken, and this state is neither.
 */
export function BillingCell({ billing, testId }: Props) {
  const overdue = overdueLabel(billing?.overdueDays ?? null);

  if (overdue !== null) {
    return (
      <Badge variant='destructive' data-testid={testId}>
        {overdue}
      </Badge>
    );
  }

  if (!billing || billing.paidThroughAt === null) {
    return (
      <span data-testid={testId} className='text-muted-foreground'>
        Sin pagos
      </span>
    );
  }

  return <span data-testid={testId}>{formatDate(billing.paidThroughAt)}</span>;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');

  return `${day}/${month}/${year}`;
}
