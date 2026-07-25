/**
 * T-24 / audit-view (Slice 3, Phase 3) — AuditTable component tests
 * Spec: platform-audit-feed — viewpro-web Global Audit Feed + "Resolved
 *   identity as primary display" (design D11)
 *
 * Tests cover:
 *   - Renders one row per item
 *   - Resolved actor identity as PRIMARY display (D11): actorEmail, then
 *     native actor.email, then the type:'user' generic label
 *     (verify-slice1 D11 gap fix — NEVER a raw UUID), then outbox operator
 *     label/id as a last resort
 *   - Resolved tenant name as primary display, raw tenantId fallback
 *   - A source badge distinguishes INMOVIEW_OUTBOX vs VIEWPRO_NATIVE
 *   - Action label (Q4 map), old→new (via renderValue), timestamp
 *   - Rows render in the order received (no client re-sort)
 *   - An unmapped action renders raw (never throws)
 *   - Malformed/absent previousValue/newValue degrade to '—' (never throws)
 *   - Row click expands/collapses the AuditRowDetail drill-down (D12)
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    actor: {
      id: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
      type: 'user',
      label: 'a1b2c3d4-5678-90ab-cdef-1234567890ab'
    },
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

  it('falls back to actor.label when no actorEmail is resolved (outbox operator)', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-actor-audit-1').textContent).toContain('op-1');
  });

  it('renders the action label per row (Q4 map)', () => {
    render(<AuditTable items={ITEMS} />);

    expect(screen.getByTestId('audit-action-audit-1').textContent).toBe('Estado');
    expect(screen.getByTestId('audit-action-audit-2').textContent).toBe('Límites');
  });

  it('falls back to the raw tenantId when no tenantName is resolved', () => {
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

  it('renders rows in the order received (server already sorts occurredAt DESC)', () => {
    render(<AuditTable items={ITEMS} />);

    const rows = screen.getAllByTestId(/^audit-row-audit-/);
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

// D11 — resolved identity is the PRIMARY display; a raw UUID must never
// appear as primary content (spec: "Resolved identity as primary display").
describe('AuditTable — resolved identity as primary display (D11)', () => {
  it('shows the resolved actorEmail (not the raw id) for an outbox operator row, with a source badge (Scenario: outbox operator row)', () => {
    const item: AuditLogItem = {
      ...ITEMS[0],
      id: 'audit-resolved-1',
      actorEmail: 'operador@viewpro.test',
      source: 'INMOVIEW_OUTBOX'
    };

    render(<AuditTable items={[item]} />);

    const actorCell = screen.getByTestId('audit-actor-audit-resolved-1').textContent ?? '';
    expect(actorCell).toContain('operador@viewpro.test');
    expect(actorCell).not.toContain('op-1');
    expect(screen.getByTestId('audit-source-audit-resolved-1').textContent).toBe('InmoView');
  });

  it('shows the resolved tenant name (not the raw id) for a native document-view row, with a distinct native badge (Scenario: native document-view row)', () => {
    const item: AuditLogItem = {
      id: 'audit-native-doc-1',
      action: 'TENANT_DOCUMENT_VIEWED',
      tenantId: 'tenant-9',
      tenantName: 'Inmobiliaria Sur',
      actor: { id: 'op-9', email: 'admin@viewpro.local' },
      target: { documentVersionId: 'ver-1', filename: 'escritura.pdf' },
      previousValue: null,
      newValue: null,
      occurredAt: '2026-07-15T11:00:00.000Z',
      seqNo: null,
      source: 'VIEWPRO_NATIVE'
    };

    render(<AuditTable items={[item]} />);

    const tenantCell = screen.getByTestId('audit-tenant-audit-native-doc-1').textContent ?? '';
    expect(tenantCell).toBe('Inmobiliaria Sur');
    expect(tenantCell).not.toContain('tenant-9');
    expect(screen.getByTestId('audit-source-audit-native-doc-1').textContent).toBe('ViewPro');

    // A document-view carries no old→new delta (both null): the "Cambio" cell
    // must show the document filename, never a meaningless "— → —" placeholder.
    const changeCell = screen.getByTestId('audit-change-audit-native-doc-1').textContent ?? '';
    expect(changeCell).toContain('escritura.pdf');
    expect(changeCell).not.toContain('→');
  });

  // verify-slice1's D11 conformance finding: a type:'user' outbox actor's
  // label/id are BOTH the raw UUID — must show the generic label instead.
  it('shows the generic "Usuario de la inmobiliaria" label for a type:user actor — NEVER the raw UUID', () => {
    render(<AuditTable items={[ITEMS[1]]} />);

    const actorCell = screen.getByTestId('audit-actor-audit-2').textContent ?? '';
    expect(actorCell).toContain('Usuario de la inmobiliaria');
    expect(actorCell).not.toContain('a1b2c3d4-5678-90ab-cdef-1234567890ab');
  });
});

describe('AuditTable — drill-down expand/collapse (design D12)', () => {
  it('expands a forensic detail panel on row click, and collapses it on a second click', async () => {
    const user = userEvent.setup();
    render(<AuditTable items={[ITEMS[0]]} />);

    expect(screen.queryByTestId('audit-detail-audit-1')).toBeNull();

    await user.click(screen.getByTestId('audit-row-audit-1'));
    expect(screen.getByTestId('audit-detail-audit-1')).toBeTruthy();

    await user.click(screen.getByTestId('audit-row-audit-1'));
    expect(screen.queryByTestId('audit-detail-audit-1')).toBeNull();
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

  it('renders "—" for a native entry with a null tenantId and no tenantName', () => {
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
