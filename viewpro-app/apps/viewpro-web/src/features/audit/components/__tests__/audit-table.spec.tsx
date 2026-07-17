/**
 * T-24 — RED: AuditTable component tests
 * Spec: platform-audit-log — viewpro-web Global Audit Feed (feed-renders scenario)
 *
 * Tests cover:
 *   - Renders one row per item
 *   - Actor label, action label (Q4 map), target tenant, timestamp, and
 *     old→new (via renderValue) are all shown per row
 *   - Rows render in the order received (no client re-sort)
 *   - An unmapped action renders raw (never throws)
 *   - Malformed/absent previousValue/newValue degrade to '—' (never throws)
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { AuditLogItem } from '@/features/audit/api/types';
import { AuditTable } from '../audit-table';

const ITEMS: AuditLogItem[] = [
  {
    id: 'audit-1',
    action: 'TENANT_STATUS_CHANGED',
    tenantId: 'tenant-1',
    actor: { id: 'op-1', type: 'operator', label: 'op-1' },
    previousValue: { status: 'TRIAL' },
    newValue: { status: 'ACTIVE' },
    occurredAt: '2026-07-15T10:00:00.000Z',
    seqNo: 2
  },
  {
    id: 'audit-2',
    action: 'TENANT_LIMITS_UPDATED',
    tenantId: 'tenant-2',
    actor: { id: 'usr-1', type: 'user', label: 'usr-1' },
    previousValue: { maxUsers: 10 },
    newValue: { maxUsers: 25 },
    occurredAt: '2026-07-15T09:00:00.000Z',
    seqNo: 1
  }
];

describe('AuditTable — renders fetched rows', () => {
  it('renders one row per item', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-row-audit-1')).toBeTruthy();
    expect(screen.getByTestId('audit-row-audit-2')).toBeTruthy();
  });

  it('renders the actor label per row', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-actor-audit-1').textContent).toContain('op-1');
    expect(screen.getByTestId('audit-actor-audit-2').textContent).toContain('usr-1');
  });

  it('renders the action label per row (Q4 map)', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-action-audit-1').textContent).toBe('Estado');
    expect(screen.getByTestId('audit-action-audit-2').textContent).toBe('Límites');
  });

  it('renders the target tenant per row', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-tenant-audit-1').textContent).toContain('tenant-1');
    expect(screen.getByTestId('audit-tenant-audit-2').textContent).toContain('tenant-2');
  });

  it('renders a formatted timestamp per row', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-date-audit-1').textContent).toBeTruthy();
  });

  it('renders the old→new change per row', () => {
    render(<AuditTable items={ITEMS} />);

    const change = screen.getByTestId('audit-change-audit-1').textContent ?? '';
    expect(change).toContain('TRIAL');
    expect(change).toContain('ACTIVE');
  });

  it('renders rows in the order received (server already sorts seqNo DESC)', () => {
    render(<AuditTable items={ITEMS} />);

    const rows = screen.getAllByTestId(/audit-row-/);
    expect(rows[0].getAttribute('data-testid')).toBe('audit-row-audit-1');
    expect(rows[1].getAttribute('data-testid')).toBe('audit-row-audit-2');
  });

  it('renders an unmapped action raw without throwing', () => {
    const items: AuditLogItem[] = [
      { ...ITEMS[0], id: 'audit-3', action: 'TENANT_PLAN_CHANGED' }
    ];

    render(<AuditTable items={items} />);

    expect(screen.getByTestId('audit-action-audit-3').textContent).toBe('TENANT_PLAN_CHANGED');
  });

  it('degrades a null/absent previousValue to "—" without throwing', () => {
    const items: AuditLogItem[] = [
      { ...ITEMS[0], id: 'audit-4', previousValue: null, newValue: undefined }
    ];

    expect(() => render(<AuditTable items={items} />)).not.toThrow();
    expect(screen.getByTestId('audit-change-audit-4').textContent).toContain('—');
  });
});

// A4 — the feed is heterogeneous: VIEWPRO_NATIVE operator-management entries
// have a different shape (actor {id,email}, target {id,email}, tenantId/seqNo
// null). The table must render BOTH shapes side by side — a native entry must
// NOT crash the page.
describe('AuditTable — heterogeneous feed (native + outbox)', () => {
  const NATIVE_ITEM: AuditLogItem = {
    id: 'audit-native-1',
    action: 'OPERATOR_CREATED',
    tenantId: null,
    actor: { id: 'op-9', email: 'admin@viewpro.local' },
    target: { id: 'op-10', email: 'demo.operador@viewpro.local' },
    previousValue: null,
    newValue: null,
    occurredAt: '2026-07-15T11:00:00.000Z',
    seqNo: null,
    source: 'VIEWPRO_NATIVE'
  };

  it('renders both an outbox and a native row without throwing', () => {
    const items: AuditLogItem[] = [ITEMS[0], NATIVE_ITEM];

    expect(() => render(<AuditTable items={items} />)).not.toThrow();
    expect(screen.getByTestId('audit-row-audit-1')).toBeTruthy();
    expect(screen.getByTestId('audit-row-audit-native-1')).toBeTruthy();
  });

  it('shows the native actor email (no label/type) as the actor line', () => {
    render(<AuditTable items={[NATIVE_ITEM]} />);

    expect(screen.getByTestId('audit-actor-audit-native-1').textContent).toContain(
      'admin@viewpro.local'
    );
  });

  it('renders "—" for a native entry with a null tenantId', () => {
    render(<AuditTable items={[NATIVE_ITEM]} />);

    expect(screen.getByTestId('audit-tenant-audit-native-1').textContent).toBe('—');
  });

  it('maps the native action code to its Spanish label', () => {
    render(<AuditTable items={[NATIVE_ITEM]} />);

    expect(screen.getByTestId('audit-action-audit-native-1').textContent).toBe('Operador creado');
  });

  it('shows the target operator email in the change cell', () => {
    render(<AuditTable items={[NATIVE_ITEM]} />);

    expect(screen.getByTestId('audit-change-audit-native-1').textContent).toContain(
      'demo.operador@viewpro.local'
    );
  });
});
