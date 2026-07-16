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
                <p className='font-medium'>{item.actor.label}</p>
                <p className='text-muted-foreground text-xs'>{item.actor.type}</p>
              </div>
            </TableCell>
            <TableCell data-testid={`audit-action-${item.id}`}>
              {actionLabel(item.action)}
            </TableCell>
            <TableCell data-testid={`audit-tenant-${item.id}`}>{item.tenantId}</TableCell>
            <TableCell data-testid={`audit-date-${item.id}`}>
              {formatOccurredAt(item.occurredAt)}
            </TableCell>
            <TableCell data-testid={`audit-change-${item.id}`}>
              <div className='text-muted-foreground space-y-1 text-xs whitespace-pre-line'>
                <div>{renderValue(item.previousValue)}</div>
                <div className='text-foreground'>→ {renderValue(item.newValue)}</div>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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
