/**
 * audit-view (Slice 3, Phase 3), tasks 3.7/3.8 — AuditRowDetail forensic
 * drill-down tests.
 * Spec: platform-audit-feed — "Drill-down forensic detail" (design D12 —
 * copies, does not extract/share, the <dl> pattern from
 * tenant-activity-feed.tsx; this feature must not import tenant-specific
 * formatters).
 *
 * Tests cover:
 *   - Expanding an outbox row shows resolved actor, raw actor id, tenant
 *     name, raw tenant id, the ACTION_LABELS label, before→after, a full
 *     timestamp, source, and a numeric seqNo (Scenario: expand outbox row)
 *   - Expanding a native row with no delta omits the before→after fields
 *     entirely and never renders a stray "null"/"undefined" string
 *     (Scenario: expand native row with no delta)
 *   - Type-specific target fields: documentVersionId/filename for
 *     TENANT_DOCUMENT_VIEWED, id/email for operator-management actions
 */

import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { AuditLogItem } from '@/features/audit/api/types';
import { AuditRowDetail } from '../audit-row-detail';

describe('AuditRowDetail — expand an outbox row (Scenario: expand outbox row)', () => {
  const OUTBOX_ITEM: AuditLogItem = {
    id: 'audit-outbox-1',
    action: 'TENANT_LIMITS_UPDATED',
    tenantId: 'tenant-1',
    tenantName: 'Inmobiliaria Norte',
    actor: { id: 'op-1', type: 'operator', label: 'op-1' },
    actorEmail: 'operador@viewpro.test',
    previousValue: { maxUsers: 10 },
    newValue: { maxUsers: 25 },
    occurredAt: '2026-07-15T10:00:00.000Z',
    seqNo: 42,
    source: 'INMOVIEW_OUTBOX'
  };

  it('shows the resolved actor and the raw actor id', () => {
    render(<AuditRowDetail item={OUTBOX_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-outbox-1').textContent ?? '';
    expect(detail).toContain('operador@viewpro.test');
    expect(detail).toContain('op-1');
  });

  it('shows the resolved tenant name and the raw tenant id', () => {
    render(<AuditRowDetail item={OUTBOX_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-outbox-1').textContent ?? '';
    expect(detail).toContain('Inmobiliaria Norte');
    expect(detail).toContain('tenant-1');
  });

  it('shows the action label via ACTION_LABELS (not the raw code)', () => {
    render(<AuditRowDetail item={OUTBOX_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-outbox-1').textContent ?? '';
    expect(detail).toContain('Límites');
    expect(detail).not.toContain('TENANT_LIMITS_UPDATED');
  });

  it('shows before→after values (via renderValue)', () => {
    render(<AuditRowDetail item={OUTBOX_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-outbox-1').textContent ?? '';
    expect(detail).toContain('maxUsers: 10');
    expect(detail).toContain('maxUsers: 25');
  });

  it('shows the full timestamp, source, and a numeric seqNo', () => {
    render(<AuditRowDetail item={OUTBOX_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-outbox-1').textContent ?? '';
    expect(detail).toContain('2026');
    expect(detail).toContain('InmoView');
    expect(detail).toContain('42');
  });
});

describe('AuditRowDetail — expand a native row with no delta (Scenario: expand native row with no delta)', () => {
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

  it('omits the before→after fields entirely (mirrors hasValueDelta)', () => {
    render(<AuditRowDetail item={NATIVE_ITEM} />);

    expect(screen.queryByText('Antes')).toBeNull();
    expect(screen.queryByText('Después')).toBeNull();
  });

  it('never renders a stray "null"/"undefined" string for the absent tenant/seqNo', () => {
    render(<AuditRowDetail item={NATIVE_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-native-1').textContent ?? '';
    expect(detail).not.toContain('null');
    expect(detail).not.toContain('undefined');
  });

  it('shows the operator target id/email (not a document field)', () => {
    render(<AuditRowDetail item={NATIVE_ITEM} />);

    const detail = screen.getByTestId('audit-detail-audit-native-1').textContent ?? '';
    expect(detail).toContain('demo.operador@viewpro.local');
  });
});

describe('AuditRowDetail — type-specific target fields', () => {
  it('shows documentVersionId/filename for TENANT_DOCUMENT_VIEWED', () => {
    const item: AuditLogItem = {
      id: 'audit-doc-1',
      action: 'TENANT_DOCUMENT_VIEWED',
      tenantId: 'tenant-5',
      tenantName: 'Inmobiliaria Sur',
      actor: { id: 'op-2', email: 'admin@viewpro.local' },
      target: { documentVersionId: 'ver-123', filename: 'escritura.pdf' },
      previousValue: null,
      newValue: null,
      occurredAt: '2026-07-15T12:00:00.000Z',
      seqNo: null,
      source: 'VIEWPRO_NATIVE'
    };

    render(<AuditRowDetail item={item} />);

    const detail = screen.getByTestId('audit-detail-audit-doc-1').textContent ?? '';
    expect(detail).toContain('ver-123');
    expect(detail).toContain('escritura.pdf');
  });

  it('does not throw and shows no target fields when target is absent', () => {
    const item: AuditLogItem = {
      id: 'audit-no-target-1',
      action: 'TENANT_STATUS_CHANGED',
      tenantId: 'tenant-1',
      actor: { id: 'op-1', type: 'operator', label: 'op-1' },
      previousValue: { status: 'TRIAL' },
      newValue: { status: 'ACTIVE' },
      occurredAt: '2026-07-15T10:00:00.000Z',
      seqNo: 1,
      source: 'INMOVIEW_OUTBOX'
    };

    expect(() => render(<AuditRowDetail item={item} />)).not.toThrow();
    expect(screen.getByTestId('audit-detail-audit-no-target-1')).toBeTruthy();
  });
});

// platform-payment-ledger — the ledger exists so an activation can be traced
// back to money that actually arrived. A reversal that cannot name the payment
// it cancelled breaks that chain exactly where fraud would hide: the operator
// who records a payment and then quietly reverses it.
describe('AuditRowDetail — money actions name the payment', () => {
  it('shows the reversed payment and the reversal row for PAYMENT_REVERSED', () => {
    const item: AuditLogItem = {
      id: 'audit-pay-rev-1',
      action: 'PAYMENT_REVERSED',
      tenantId: 'tenant-5',
      tenantName: 'Inmobiliaria Sur',
      actor: { id: 'op-2', email: 'admin@viewpro.local' },
      target: { paymentId: 'pay-original', reversalId: 'pay-reversal' },
      previousValue: null,
      newValue: null,
      occurredAt: '2026-07-15T12:00:00.000Z',
      seqNo: null,
      source: 'VIEWPRO_NATIVE'
    };

    render(<AuditRowDetail item={item} />);

    const detail = screen.getByTestId('audit-detail-audit-pay-rev-1').textContent ?? '';
    expect(detail).toContain('pay-original');
    expect(detail).toContain('pay-reversal');
  });

  it('shows the recorded payment for PAYMENT_RECORDED (no reversal row to name)', () => {
    const item: AuditLogItem = {
      id: 'audit-pay-rec-1',
      action: 'PAYMENT_RECORDED',
      tenantId: 'tenant-5',
      tenantName: 'Inmobiliaria Sur',
      actor: { id: 'op-2', email: 'admin@viewpro.local' },
      target: { paymentId: 'pay-original' },
      previousValue: null,
      newValue: null,
      occurredAt: '2026-07-15T12:00:00.000Z',
      seqNo: null,
      source: 'VIEWPRO_NATIVE'
    };

    render(<AuditRowDetail item={item} />);

    const detail = screen.getByTestId('audit-detail-audit-pay-rec-1').textContent ?? '';
    expect(detail).toContain('pay-original');
  });
});
