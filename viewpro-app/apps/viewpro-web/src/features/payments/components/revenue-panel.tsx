'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RevenueSummary } from '@/features/payments/api/types';
import { formatAmount } from './money-format';

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

type Props = { summary: RevenueSummary };

/**
 * RevenuePanel — what the product collected, and who stopped paying.
 *
 * The attribution note is deliberate. Under manual billing an annual
 * prepayment or a transfer entered three days late makes "collected in August"
 * and "revenue for August" different numbers. A figure whose basis is unstated
 * eventually becomes a business decision, so the panel says what it measures.
 *
 * The overdue count renders even when it is zero. Hiding it would make "nobody
 * is overdue" and "the panel failed to load" look identical — and since
 * nothing suspends a lapsed tenant automatically, this count is the only
 * signal that anyone stopped paying.
 */
export function RevenuePanel({ summary }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobrado</CardTitle>
        <p className='text-muted-foreground text-sm'>
          Cobrado por mes, según el mes en que se registró el pago (no el período que cubre).
        </p>
      </CardHeader>

      <CardContent>
        <OverdueSummary count={summary.overdueTenants} />

        {summary.months.length === 0 ? (
          <p>Todavía no hay pagos registrados.</p>
        ) : (
          <ul>
            {summary.months.map((month) => (
              <li key={`${month.month}-${month.currency}`}>
                <h3>{monthLabel(month.month)}</h3>
                <p data-testid={`revenue-total-${month.month}`}>
                  {formatAmount(month.totalMinorUnits, month.currency)}
                </p>
                <ul>
                  {month.rows.map((row) => (
                    <li key={`${row.plan}-${row.currency}`}>
                      <span>{row.plan}</span>
                      <span>{formatAmount(row.collectedMinorUnits, row.currency)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function OverdueSummary({ count }: { count: number }) {
  if (count === 0) {
    return <p data-testid='overdue-count'>Sin inmobiliarias vencidas.</p>;
  }

  return (
    <Badge variant='destructive' data-testid='overdue-count'>
      {count === 1 ? '1 inmobiliaria vencida' : `${count} inmobiliarias vencidas`}
    </Badge>
  );
}

/** "2026-08" → "agosto 2026". */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split('-');
  const name = MONTH_NAMES[Number(monthNumber) - 1] ?? month;

  return `${name} ${year}`;
}
