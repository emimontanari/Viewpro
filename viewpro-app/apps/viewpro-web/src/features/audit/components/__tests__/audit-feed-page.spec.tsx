/**
 * T-24 — RED: AuditFeedPage container tests
 * Spec: platform-audit-log — viewpro-web Global Audit Feed (all 5 scenarios)
 *
 * Tests cover:
 *   - Loading → loading indicator, no table
 *   - Success with total>0 → <AuditTable/> + <AuditPager/> rendered
 *   - Success with total===0 → <AuditEmptyState/> rendered instead of the table
 *   - Error (fetch failure) → error message shown, no unhandled exception
 *   - Pagination: triggering next-page control issues a request for the next
 *     offset; returned rows replace the displayed list
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { AuditFeedResponse, AuditLogItem } from '@/features/audit/api/types';

// Mock the api service — queries.ts is real and delegates to this mock.
vi.mock('@/features/audit/api/service', () => ({
  getAuditFeed: vi.fn()
}));

// Mock the table to isolate container logic from audit-table's own rendering
// (already covered by audit-table.spec.tsx, T-24).
vi.mock('../audit-table', () => ({
  AuditTable: ({ items }: { items: AuditLogItem[] }) => (
    <div data-testid='audit-table'>
      {items.map((item) => (
        <span key={item.id} data-testid={`mock-item-${item.id}`}>
          {item.action}
        </span>
      ))}
    </div>
  )
}));

vi.mock('../audit-pager', () => ({
  AuditPager: ({
    offset,
    total,
    onNext,
    onPrev
  }: {
    offset: number;
    total: number;
    disabled?: boolean;
    onNext: () => void;
    onPrev: () => void;
  }) => (
    <div data-testid='audit-pager'>
      <span data-testid='pager-offset'>{offset}</span>
      <span data-testid='pager-total'>{total}</span>
      <button type='button' onClick={onPrev}>
        prev
      </button>
      <button type='button' onClick={onNext}>
        next
      </button>
    </div>
  )
}));

vi.mock('../audit-empty-state', () => ({
  AuditEmptyState: () => <div data-testid='audit-empty-state'>vacío</div>
}));

import { getAuditFeed } from '@/features/audit/api/service';
import { AuditFeedPage } from '../audit-feed-page';

const mockGetAuditFeed = vi.mocked(getAuditFeed);

const ITEM: AuditLogItem = {
  id: 'audit-1',
  action: 'TENANT_STATUS_CHANGED',
  tenantId: 'tenant-1',
  actor: { id: 'op-1', type: 'operator', label: 'op-1' },
  previousValue: { status: 'TRIAL' },
  newValue: { status: 'ACTIVE' },
  occurredAt: '2026-07-15T10:00:00.000Z',
  seqNo: 3
};

const NON_EMPTY_RESPONSE: AuditFeedResponse = { total: 60, items: [ITEM] };
const EMPTY_RESPONSE: AuditFeedResponse = { total: 0, items: [] };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AuditFeedPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('AuditFeedPage — loading state', () => {
  it('renders a loading indicator while loading (not an error, no table)', () => {
    mockGetAuditFeed.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('audit-loading')).toBeTruthy();
    expect(screen.queryByTestId('audit-error')).toBeNull();
    expect(screen.queryByTestId('audit-table')).toBeNull();
  });
});

// ─── Success — non-empty ──────────────────────────────────────────────────────

describe('AuditFeedPage — success with total>0', () => {
  it('renders AuditTable and AuditPager (spec scenario 1)', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('audit-table')).toBeTruthy();
    });
    expect(screen.getByTestId('audit-pager')).toBeTruthy();
    expect(screen.getByTestId('mock-item-audit-1').textContent).toBe('TENANT_STATUS_CHANGED');
    expect(screen.queryByTestId('audit-empty-state')).toBeNull();
  });

  it('requests offset=0 limit=50 on first load', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(mockGetAuditFeed).toHaveBeenCalledWith(0, 50, {});
    });
  });
});

// ─── Success — empty ──────────────────────────────────────────────────────────

describe('AuditFeedPage — success with total===0', () => {
  it('renders AuditEmptyState instead of the table (spec scenario 4)', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('audit-empty-state')).toBeTruthy();
    });
    expect(screen.queryByTestId('audit-table')).toBeNull();
    expect(screen.queryByTestId('audit-pager')).toBeNull();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('AuditFeedPage — error state', () => {
  it('renders an inline error message on fetch failure without throwing (spec scenario 5)', async () => {
    const apiError = { status: 500, message: 'Error interno del servidor' };
    mockGetAuditFeed.mockRejectedValueOnce(apiError);

    expect(() => renderPage()).not.toThrow();

    await waitFor(() => {
      expect(screen.getByTestId('audit-error')).toBeTruthy();
    });
    expect(screen.getByTestId('audit-error').textContent).toContain('Error interno del servidor');
    expect(screen.queryByTestId('audit-table')).toBeNull();
  });
});

// ─── Pager interaction ────────────────────────────────────────────────────────

describe('AuditFeedPage — pager', () => {
  it('clicking "next" issues a new query with an increased offset; rows replace the displayed list', async () => {
    const SECOND_ITEM: AuditLogItem = { ...ITEM, id: 'audit-2', action: 'TENANT_LIMITS_UPDATED' };
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE);
    mockGetAuditFeed.mockResolvedValueOnce({ total: 60, items: [SECOND_ITEM] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('audit-pager')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    await waitFor(() => {
      expect(mockGetAuditFeed).toHaveBeenCalledWith(50, 50, {});
    });

    await waitFor(() => {
      expect(screen.getByTestId('mock-item-audit-2')).toBeTruthy();
    });
    expect(screen.queryByTestId('mock-item-audit-1')).toBeNull();
  });
});
