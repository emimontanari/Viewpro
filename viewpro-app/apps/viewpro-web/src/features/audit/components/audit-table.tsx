'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditLogItem } from '@/features/audit/api/types';
import { actionLabel, renderValue } from './render-value';

type Props = {
  items: AuditLogItem[];
};

/**
 * Global audit feed table (read-only, no mutations). Columns: Actor, Acción
 * (Q4 label map), Inmobiliaria, Fecha, Cambio (old→new via renderValue, R4).
 * Rows render in the order received — the API already sorts seqNo DESC.
 */
export function AuditTable({ items }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Actor</TableHead>
          <TableHead>Acción</TableHead>
          <TableHead>Inmobiliaria</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cambio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} data-testid={`audit-row-${item.id}`}>
            <TableCell data-testid={`audit-actor-${item.id}`}>
              <div className='space-y-1'>
                <p className='font-medium'>{actorPrimary(item.actor)}</p>
                <p className='text-muted-foreground text-xs'>{actorSecondary(item)}</p>
              </div>
            </TableCell>
            <TableCell data-testid={`audit-action-${item.id}`}>
              {actionLabel(item.action)}
            </TableCell>
            <TableCell data-testid={`audit-tenant-${item.id}`}>{item.tenantId ?? '—'}</TableCell>
            <TableCell data-testid={`audit-date-${item.id}`}>
              {formatOccurredAt(item.occurredAt)}
            </TableCell>
            <TableCell data-testid={`audit-change-${item.id}`}>
              <div className='text-muted-foreground space-y-1 text-xs whitespace-pre-line'>
                {item.target?.email ? (
                  <div className='text-foreground'>{item.target.email}</div>
                ) : null}
                {!item.target?.email || hasValueDelta(item) ? (
                  <>
                    <div>{renderValue(item.previousValue)}</div>
                    <div className='text-foreground'>→ {renderValue(item.newValue)}</div>
                  </>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// A4 — heterogeneous actor: outbox carries {type,label}, native carries
// {email}. Prefer the human label, fall back to email, then the raw id —
// never render `undefined`.
function actorPrimary(actor: AuditLogItem['actor']): string {
  return actor.label ?? actor.email ?? actor.id;
}

// Secondary line: outbox actor `type`, or a sensible role for native entries.
function actorSecondary(item: AuditLogItem): string {
  return item.actor.type ?? (item.source === 'VIEWPRO_NATIVE' ? 'operador' : '');
}

// Native OPERATOR_CREATED/SUSPENDED/REACTIVATED carry no old→new delta
// (both null); OPERATOR_ROLE_CHANGED does. Only render the arrow when there is
// an actual value to show.
function hasValueDelta(item: AuditLogItem): boolean {
  return item.previousValue != null || item.newValue != null;
}

// Malformed occurredAt degrades to the raw string rather than throwing
// (mirrors the FE-wide "never throw on unexpected server shape" convention).
function formatOccurredAt(occurredAt: string) {
  const date = new Date(occurredAt);

  if (Number.isNaN(date.getTime())) {
    return occurredAt;
  }

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}
