/**
 * T-07 — RED: TenantsManagementPage container tests (PR1 subset — list only)
 * Spec: Paginated Tenant List (all 4 scenarios); Error Handling (generic list-load failure)
 *
 * Tests cover:
 *   - Loading → skeleton (not an error)
 *   - Success with total>0 → <TenantsTable/> + <TenantsPager/> rendered
 *   - Success with total===0 → <TenantsEmptyState/> rendered instead of the table
 *   - Error (non-401) → inline error card via getApiErrorMessage
 *   - Clicking "next page" issues a new query with an increased offset;
 *     requested limit never exceeds 200
 *
 * Mutation/confirm/unchanged/404 scenarios are added in T-16 (WU-2).
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import type { TenantListItem, TenantListResponse } from '@/features/tenants/api/types';

// Mock the api service — queries.ts is real and delegates to this mock.
vi.mock('@/features/tenants/api/service', () => ({
  getTenantList: vi.fn(),
  updateTenantStatus: vi.fn(),
  updateTenantLimits: vi.fn()
}));

// Mock presentational children to isolate container logic.
vi.mock('../tenants-table', () => ({
  TenantsTable: ({ items }: { items: TenantListItem[] }) => (
    <div data-testid='tenants-table'>
      {items.map((item) => (
        <span key={item.id} data-testid={`mock-item-${item.id}`}>
          {item.name}
        </span>
      ))}
    </div>
  )
}));

vi.mock('../tenants-pager', () => ({
  TenantsPager: ({
    offset,
    total,
    onNext,
    onPrev
  }: {
    offset: number;
    total: number;
    onNext: () => void;
    onPrev: () => void;
  }) => (
    <div data-testid='tenants-pager'>
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

vi.mock('../tenants-empty-state', () => ({
  TenantsEmptyState: () => <div data-testid='tenants-empty-state'>vacío</div>
}));

import { getTenantList } from '@/features/tenants/api/service';
import { TenantsManagementPage } from '../tenants-management-page';

const mockGetTenantList = vi.mocked(getTenantList);

const ITEM: TenantListItem = {
  id: 'tenant-1',
  name: 'Acme Realty',
  slug: 'acme-realty',
  status: 'ACTIVE',
  limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 }
};

const NON_EMPTY_RESPONSE: TenantListResponse = { total: 60, items: [ITEM] };
const EMPTY_RESPONSE: TenantListResponse = { total: 0, items: [] };

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TenantsManagementPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('TenantsManagementPage — loading state', () => {
  it('renders a skeleton while loading (not an error)', () => {
    mockGetTenantList.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('tenants-loading-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('tenants-error')).toBeNull();
  });
});

// ─── Success — non-empty ──────────────────────────────────────────────────────

describe('TenantsManagementPage — success with total>0', () => {
  it('renders TenantsTable and TenantsPager (spec scenario 1)', async () => {
    mockGetTenantList.mockResolvedValueOnce(NON_EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenants-table')).toBeTruthy();
    });
    expect(screen.getByTestId('tenants-pager')).toBeTruthy();
    expect(screen.getByTestId('mock-item-tenant-1').textContent).toBe('Acme Realty');
    expect(screen.queryByTestId('tenants-empty-state')).toBeNull();
  });

  it('requests offset=0 limit=50 on first load (limit never exceeds 200)', async () => {
    mockGetTenantList.mockResolvedValueOnce(NON_EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(mockGetTenantList).toHaveBeenCalledWith(0, 50);
    });
  });
});

// ─── Success — empty ──────────────────────────────────────────────────────────

describe('TenantsManagementPage — success with total===0', () => {
  it('renders TenantsEmptyState instead of the table (spec scenario 4)', async () => {
    mockGetTenantList.mockResolvedValueOnce(EMPTY_RESPONSE);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenants-empty-state')).toBeTruthy();
    });
    expect(screen.queryByTestId('tenants-table')).toBeNull();
    expect(screen.queryByTestId('tenants-pager')).toBeNull();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('TenantsManagementPage — error state', () => {
  it('renders an inline error card on non-401 failure', async () => {
    const apiError = { status: 500, message: 'Error interno del servidor' };
    mockGetTenantList.mockRejectedValueOnce(apiError);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenants-error')).toBeTruthy();
    });
    expect(screen.getByTestId('tenants-error').textContent).toContain('Error interno del servidor');
    expect(screen.queryByTestId('tenants-table')).toBeNull();
  });
});

// ─── Pager interaction ────────────────────────────────────────────────────────

describe('TenantsManagementPage — pager', () => {
  it('clicking "next" issues a new query with an increased offset (limit unchanged)', async () => {
    mockGetTenantList.mockResolvedValueOnce(NON_EMPTY_RESPONSE);
    mockGetTenantList.mockResolvedValueOnce({ total: 60, items: [ITEM] });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tenants-pager')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'next' }));

    await waitFor(() => {
      expect(mockGetTenantList).toHaveBeenCalledWith(50, 50);
    });

    // limit param across every call never exceeds the API's 200 cap
    for (const call of mockGetTenantList.mock.calls) {
      expect(call[1]).toBeLessThanOrEqual(200);
    }
  });
});
