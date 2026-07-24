'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AuditLogItem } from '@/features/audit/api/types';
import { actorPrimary, actorSecondary, sourceLabel } from './audit-identity';
import { AuditRowDetail } from './audit-row-detail';
import { actionLabel, renderValue } from './render-value';
import styles from './audit.module.css';

type Props = {
  items: AuditLogItem[];
};

// Actor, Acción, Inmobiliaria, Origen, Fecha, Cambio, chevron.
const COLUMN_COUNT = 7;

const CHEVRON_SVG_PROPS = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false
};

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg {...CHEVRON_SVG_PROPS} className={styles.rowChevron} data-state={isOpen ? 'open' : 'closed'}>
      <polyline points='6 9 12 15 18 9' />
    </svg>
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

// Native OPERATOR_CREATED/SUSPENDED/REACTIVATED carry no old→new delta
// (both null); OPERATOR_ROLE_CHANGED does. Only render the arrow when there is
// an actual value to show.
function hasValueDelta(item: AuditLogItem): boolean {
  return item.previousValue != null || item.newValue != null;
}

/**
 * Global audit feed table (read-only, no mutations). Columns: Actor
 * (resolved identity, design D11 — never a raw UUID as primary content),
 * Acción, Inmobiliaria (resolved tenant name, D11), Origen (source badge,
 * D11), Fecha, Cambio (old→new via renderValue, R4). Rows render in the
 * order received — the API already sorts occurredAt DESC.
 *
 * Clicking a row expands a forensic drill-down (AuditRowDetail, design
 * D12) beneath it — one row expanded at a time.
 */
export function AuditTable({ items }: Props) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, id: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle(id);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Actor</TableHead>
          <TableHead>Acción</TableHead>
          <TableHead>Inmobiliaria</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cambio</TableHead>
          <TableHead aria-hidden='true' />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const isExpanded = expandedId === item.id;

          return (
            <React.Fragment key={item.id}>
              <TableRow
                data-testid={`audit-row-${item.id}`}
                role='button'
                tabIndex={0}
                aria-expanded={isExpanded}
                className={styles.clickableRow}
                onClick={() => toggle(item.id)}
                onKeyDown={(event) => handleKeyDown(event, item.id)}
              >
                <TableCell data-testid={`audit-actor-${item.id}`}>
                  <div className='space-y-1'>
                    <p className='font-medium'>{actorPrimary(item)}</p>
                    <p className='text-muted-foreground text-xs'>{actorSecondary(item)}</p>
                  </div>
                </TableCell>
                <TableCell data-testid={`audit-action-${item.id}`}>
                  {actionLabel(item.action)}
                </TableCell>
                <TableCell data-testid={`audit-tenant-${item.id}`}>
                  {item.tenantName ?? item.tenantId ?? '—'}
                </TableCell>
                <TableCell data-testid={`audit-source-${item.id}`}>
                  <Badge variant={item.source === 'VIEWPRO_NATIVE' ? 'default' : 'outline'}>
                    {sourceLabel(item.source)}
                  </Badge>
                </TableCell>
                <TableCell data-testid={`audit-date-${item.id}`}>
                  {formatOccurredAt(item.occurredAt)}
                </TableCell>
                <TableCell data-testid={`audit-change-${item.id}`}>
                  <div className='text-muted-foreground space-y-1 text-xs whitespace-pre-line'>
                    {item.target?.email ? (
                      <div className='text-foreground'>{item.target.email}</div>
                    ) : null}
                    {item.target?.filename ? (
                      <div className='text-foreground'>{item.target.filename}</div>
                    ) : null}
                    {/* Show the old→new arrow only when there is an actual delta,
                       or when the row has no target-specific content to show
                       (a plain '—' beats an empty cell). A document-view target
                       ({filename}, no delta) shows the filename above, not '— → —'. */}
                    {(!item.target?.email && !item.target?.filename) || hasValueDelta(item) ? (
                      <>
                        <div>{renderValue(item.previousValue)}</div>
                        <div className='text-foreground'>→ {renderValue(item.newValue)}</div>
                      </>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <ChevronIcon isOpen={isExpanded} />
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow className='hover:bg-transparent'>
                  <TableCell colSpan={COLUMN_COUNT} className={styles.rowDetail}>
                    <AuditRowDetail item={item} />
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
