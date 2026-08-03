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
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';

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
  AuditEmptyState: ({ filtered }: { filtered?: boolean }) => (
    <div data-testid='audit-empty-state' data-filtered={String(Boolean(filtered))}>
      vacío
    </div>
  )
}));

// Mock the filter bar to isolate container wiring (offset reset, filters →
// query key, hasActiveFilters) from the filter bar's own control rendering
// (already covered by audit-filter-bar.spec.tsx, task 4.1).
vi.mock('../audit-filter-bar', () => ({
  AuditFilterBar: ({
    onChange,
    onClear,
    hasActiveFilters
  }: {
    onChange: (patch: Record<string, string>) => void;
    onClear: () => void;
    hasActiveFilters: boolean;
  }) => (
    <div data-testid='audit-filter-bar'>
      <span data-testid='has-active-filters'>{String(hasActiveFilters)}</span>
      <button type='button' onClick={() => onChange({ action: 'OPERATOR_SUSPENDED' })}>
        set-action
      </button>
      <button type='button' onClick={onClear}>
        clear
      </button>
    </div>
  )
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

/**
 * `urlUpdates` is not decoration: nuqs flushes URL writes through a queue that
 * is shared module-wide and drained on a timer, so a filter change made in one
 * test can still be in flight when the next one mounts — and then lands on the
 * new adapter, silently reinstating a filter nobody clicked. Awaiting the flush
 * after each interaction both drains that queue and asserts what design D9
 * actually promises: that filter state reaches the URL, shareable.
 */
function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const urlUpdates: string[] = [];
  const utils = render(
    <NuqsTestingAdapter hasMemory onUrlUpdate={(event) => urlUpdates.push(event.queryString)}>
      <QueryClientProvider client={qc}>
        <AuditFeedPage />
      </QueryClientProvider>
    </NuqsTestingAdapter>
  );

  return { ...utils, urlUpdates };
}

/** The `action` param carried by the nth URL flush, or null when absent. */
function actionParamAt(urlUpdates: string[], index: number): string | null {
  return new URLSearchParams(urlUpdates[index] ?? '').get('action');
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

// ─── Filter bar wiring (Slice 4, Phase 4, task 4.3) ───────────────────────────
// Spec: "Server-driven filter bar" — changing a filter refetches with the
// filter applied. AuditFilterBar itself is mocked above; these tests only
// verify the container's plumbing (offset reset + filters → query key +
// hasActiveFilters).

describe('AuditFeedPage — filter bar wiring', () => {
  it('reports hasActiveFilters=false initially and requests with no filters', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('has-active-filters').textContent).toBe('false');
    });
    expect(mockGetAuditFeed).toHaveBeenCalledWith(0, 50, {});
  });

  it('changing a filter refetches with the filter applied AND resets the offset back to page 1 (Scenario: changing the action filter)', async () => {
    const SECOND_ITEM: AuditLogItem = { ...ITEM, id: 'audit-2' };
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE); // initial (offset 0)
    mockGetAuditFeed.mockResolvedValueOnce({ total: 60, items: [SECOND_ITEM] }); // page 2 (offset 50)
    mockGetAuditFeed.mockResolvedValueOnce({ total: 1, items: [ITEM] }); // filtered

    const { urlUpdates } = renderPage();

    await waitFor(() => expect(screen.getByTestId('audit-pager')).toBeTruthy());

    // Move to page 2 first so we can prove the filter change resets it.
    fireEvent.click(screen.getByRole('button', { name: 'next' }));
    await waitFor(() => {
      expect(mockGetAuditFeed).toHaveBeenCalledWith(50, 50, {});
    });

    fireEvent.click(screen.getByRole('button', { name: 'set-action' }));

    await waitFor(() => {
      expect(mockGetAuditFeed).toHaveBeenCalledWith(0, 50, { action: 'OPERATOR_SUSPENDED' });
    });
    await waitFor(() => {
      expect(screen.getByTestId('has-active-filters').textContent).toBe('true');
    });
    await waitFor(() => {
      expect(actionParamAt(urlUpdates, 0)).toBe('OPERATOR_SUSPENDED');
    });
  });

  it('the clear affordance resets filters back to an empty request', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE); // initial
    mockGetAuditFeed.mockResolvedValueOnce({ total: 1, items: [ITEM] }); // filtered
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE); // cleared

    const { urlUpdates } = renderPage();
    await waitFor(() => expect(screen.getByTestId('audit-pager')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'set-action' }));
    await waitFor(() => {
      expect(mockGetAuditFeed).toHaveBeenCalledWith(0, 50, { action: 'OPERATOR_SUSPENDED' });
    });
    // Let the filter reach the URL before clearing it. Without this the clear
    // races the flush it is supposed to undo.
    await waitFor(() => {
      expect(actionParamAt(urlUpdates, 0)).toBe('OPERATOR_SUSPENDED');
    });

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    await waitFor(() => {
      expect(urlUpdates).toHaveLength(2);
    });
    expect(actionParamAt(urlUpdates, 1)).toBeNull();
    await waitFor(() => {
      expect(mockGetAuditFeed).toHaveBeenLastCalledWith(0, 50, {});
    });
    await waitFor(() => {
      expect(screen.getByTestId('has-active-filters').textContent).toBe('false');
    });
  });
});

// ─── Distinct empty states (Slice 4, Phase 4, task 4.4) ───────────────────────
// Spec Scenario: "No rows match filters" — an explicit "no matching events"
// empty state, distinct from the empty state shown when the feed has zero
// events overall.

describe('AuditFeedPage — distinct empty states', () => {
  it('renders the UNFILTERED empty state when total===0 and no filters are active', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('audit-empty-state').dataset.filtered).toBe('false');
    });
  });

  it('renders the FILTERED empty state when total===0 AFTER a filter is applied, distinct from the unfiltered one', async () => {
    mockGetAuditFeed.mockResolvedValueOnce(NON_EMPTY_RESPONSE); // initial, unfiltered has rows
    mockGetAuditFeed.mockResolvedValueOnce(EMPTY_RESPONSE); // filtered → zero matches

    const { urlUpdates } = renderPage();
    await waitFor(() => expect(screen.getByTestId('audit-table')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'set-action' }));

    await waitFor(() => {
      expect(screen.getByTestId('audit-empty-state').dataset.filtered).toBe('true');
    });
    await waitFor(() => {
      expect(actionParamAt(urlUpdates, 0)).toBe('OPERATOR_SUSPENDED');
    });
  });
});
