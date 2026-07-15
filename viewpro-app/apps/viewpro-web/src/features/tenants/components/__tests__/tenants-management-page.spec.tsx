/**
 * T-07 — RED: TenantsManagementPage container tests (PR1 subset — list only)
 * T-16 — RED: mutations, suspend confirm, unchanged, 404/500 (PR2/WU-2 subset)
 * Spec: Paginated Tenant List (all 4 scenarios); Error Handling (generic list-load
 *   failure, 404/500 mutation failure); Status Toggle with Suspend Confirmation
 *   (all 4 scenarios); Limits Editing via Modal Dialog (scenarios 2, 3);
 *   Double-Submit Guard
 *
 * Tests cover:
 *   - Loading → skeleton (not an error)
 *   - Success with total>0 → <TenantsTable/> + <TenantsPager/> rendered
 *   - Success with total===0 → <TenantsEmptyState/> rendered instead of the table
 *   - Error (non-401) → inline error card via getApiErrorMessage
 *   - Clicking "next page" issues a new query with an increased offset;
 *     requested limit never exceeds 200
 *   - Toggling status on an ACTIVE row opens the AlertDialog confirm, no PATCH yet
 *   - Confirming the dialog PATCHes status:SUSPENDED
 *   - Toggling status on a SUSPENDED row PATCHes status:ACTIVE directly (no confirm)
 *   - Success invalidates/refetches the list and closes the dialog
 *   - unchanged:true → info toast, no error, list still refetched
 *   - Editing limits opens the real TenantLimitsDialog; submitting PATCHes limits
 *   - 404 on a mutation shows a clear message; list left unchanged
 *   - Generic (500) mutation failure surfaces an error; list retains pre-failure data
 *   - The triggering button is disabled for the duration of its mutation
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

import type {
  AdminTenantLimitsUpdateResponse,
  AdminTenantStatusUpdateResponse,
  TenantListItem,
  TenantListResponse
} from '@/features/tenants/api/types';

// Mock the api service — queries.ts is real and delegates to this mock.
vi.mock('@/features/tenants/api/service', () => ({
  getTenantList: vi.fn(),
  updateTenantStatus: vi.fn(),
  updateTenantLimits: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

// Mock the table to isolate container logic from tenants-table's own rendering
// (already covered by tenants-table.spec.tsx, T-05/T-12) while still exercising
// the real onEditLimits/onToggleStatus/isMutating wiring through this mock.
// getTenantAction is re-implemented here (mirrors the real, separately-tested
// helper) because the container imports it directly from this module.
vi.mock('../tenants-table', () => ({
  getTenantAction: (item: TenantListItem) => {
    if (item.status === 'TRIAL') {
      return { targetStatus: 'ACTIVE', label: 'Activar' };
    }
    if (item.status === 'ACTIVE') {
      return { targetStatus: 'SUSPENDED', label: 'Suspender' };
    }
    if (item.status === 'SUSPENDED') {
      return { targetStatus: 'ACTIVE', label: 'Reactivar' };
    }
    return null;
  },
  TenantsTable: ({
    items,
    isMutating,
    onEditLimits,
    onToggleStatus
  }: {
    items: TenantListItem[];
    isMutating: boolean;
    onEditLimits: (item: TenantListItem) => void;
    onToggleStatus: (item: TenantListItem) => void;
  }) => (
    <div data-testid='tenants-table'>
      {items.map((item) => (
        <div key={item.id}>
          <span data-testid={`mock-item-${item.id}`}>{item.name}</span>
          <button
            type='button'
            data-testid={`mock-edit-limits-${item.id}`}
            disabled={isMutating}
            onClick={() => onEditLimits(item)}
          >
            editar-{item.id}
          </button>
          <button
            type='button'
            data-testid={`mock-toggle-status-${item.id}`}
            disabled={isMutating}
            onClick={() => onToggleStatus(item)}
          >
            alternar-{item.id}
          </button>
        </div>
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

import { getTenantList, updateTenantLimits, updateTenantStatus } from '@/features/tenants/api/service';
import { TenantsManagementPage } from '../tenants-management-page';

const mockGetTenantList = vi.mocked(getTenantList);
const mockUpdateTenantStatus = vi.mocked(updateTenantStatus);
const mockUpdateTenantLimits = vi.mocked(updateTenantLimits);
const mockToast = vi.mocked(toast);

const ITEM: TenantListItem = {
  id: 'tenant-1',
  name: 'Acme Realty',
  slug: 'acme-realty',
  status: 'ACTIVE',
  limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 }
};

const SUSPENDED_ITEM: TenantListItem = {
  id: 'tenant-2',
  name: 'Beta Homes',
  slug: 'beta-homes',
  status: 'SUSPENDED',
  limits: { maxUsers: null, maxActivePropertyEngagements: null, maxDocumentsStorageMb: null }
};

const NON_EMPTY_RESPONSE: TenantListResponse = { total: 60, items: [ITEM] };
const SUSPENDED_RESPONSE: TenantListResponse = { total: 1, items: [SUSPENDED_ITEM] };
const EMPTY_RESPONSE: TenantListResponse = { total: 0, items: [] };

const STATUS_SUCCESS_RESPONSE: AdminTenantStatusUpdateResponse = {
  tenantId: 'tenant-1',
  previousStatus: 'ACTIVE',
  status: 'SUSPENDED',
  unchanged: false,
  updatedAt: '2026-07-15T00:00:00.000Z'
};

const LIMITS_SUCCESS_RESPONSE: AdminTenantLimitsUpdateResponse = {
  tenantId: 'tenant-1',
  previousLimits: ITEM.limits,
  limits: { maxUsers: 10, maxActivePropertyEngagements: 50, maxDocumentsStorageMb: 1024 },
  unchanged: false,
  updatedAt: '2026-07-15T00:00:00.000Z'
};

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

// ─── Status toggle — suspend confirmation (T-16/WU-2) ─────────────────────────

describe('TenantsManagementPage — status toggle (suspend confirmation)', () => {
  it('opens the AlertDialog confirm for an ACTIVE row and does not PATCH yet', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));

    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(mockUpdateTenantStatus).not.toHaveBeenCalled();
  });

  it('confirming the dialog PATCHes status with {status: SUSPENDED}', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantStatus.mockResolvedValueOnce(STATUS_SUCCESS_RESPONSE);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockUpdateTenantStatus).toHaveBeenCalledWith('tenant-1', { status: 'SUSPENDED' });
    });
  });

  it('toggling status on a SUSPENDED row PATCHes status:ACTIVE directly, no confirm dialog', async () => {
    mockGetTenantList.mockResolvedValue(SUSPENDED_RESPONSE);
    mockUpdateTenantStatus.mockResolvedValueOnce({
      tenantId: 'tenant-2',
      previousStatus: 'SUSPENDED',
      status: 'ACTIVE',
      unchanged: false,
      updatedAt: '2026-07-15T00:00:00.000Z'
    });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-2'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-2'));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => {
      expect(mockUpdateTenantStatus).toHaveBeenCalledWith('tenant-2', { status: 'ACTIVE' });
    });
  });

  it('on success: invalidates/refetches the list and closes the dialog', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantStatus.mockResolvedValueOnce(STATUS_SUCCESS_RESPONSE);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetTenantList).toHaveBeenCalledTimes(2);
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('unchanged:true is handled gracefully — info toast, no error, list still refetched', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantStatus.mockResolvedValueOnce({ ...STATUS_SUCCESS_RESPONSE, unchanged: true });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalled();
    });
    expect(mockToast.error).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockGetTenantList).toHaveBeenCalledTimes(2);
    });
  });
});

// ─── Limits editing (T-16/WU-2) ────────────────────────────────────────────────

describe('TenantsManagementPage — limits editing via modal dialog', () => {
  it('clicking "Editar límites" opens the real TenantLimitsDialog', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-edit-limits-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-edit-limits-tenant-1'));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Usuarios')).toHaveValue(10);
  });

  it('submitting the dialog PATCHes limits with the edited fields; success closes and refetches', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantLimits.mockResolvedValueOnce(LIMITS_SUCCESS_RESPONSE);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-edit-limits-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-edit-limits-tenant-1'));

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar límites' }));

    await waitFor(() => {
      expect(mockUpdateTenantLimits).toHaveBeenCalledWith('tenant-1', {
        maxUsers: 10,
        maxActivePropertyEngagements: 50,
        maxDocumentsStorageMb: 1024
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetTenantList).toHaveBeenCalledTimes(2);
    });
  });
});

// ─── Error handling (T-16/WU-2) ────────────────────────────────────────────────

describe('TenantsManagementPage — mutation error handling', () => {
  it('404 on a status mutation shows a clear "no existe" message; list is left unchanged', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantStatus.mockRejectedValueOnce({ status: 404, message: 'Not found' });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El inquilino no existe o fue eliminado.');
    });
    expect(mockGetTenantList).toHaveBeenCalledTimes(1);
  });

  it('404 on a limits mutation shows a clear "no existe" message; list is left unchanged', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantLimits.mockRejectedValueOnce({ status: 404, message: 'Not found' });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-edit-limits-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-edit-limits-tenant-1'));

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar límites' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('El inquilino no existe o fue eliminado.');
    });
    expect(mockGetTenantList).toHaveBeenCalledTimes(1);
  });

  it('generic (500) mutation failure surfaces an error; page stays interactive; list retains pre-failure data', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    mockUpdateTenantStatus.mockRejectedValueOnce({
      status: 500,
      message: 'Error interno del servidor'
    });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error interno del servidor');
    });
    expect(mockGetTenantList).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mock-item-tenant-1').textContent).toBe('Acme Realty');
  });
});

// ─── Double-submit guard (T-16/WU-2) ───────────────────────────────────────────

describe('TenantsManagementPage — double-submit guard', () => {
  it('disables the confirm button while the status mutation is pending', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    let resolveMutation!: (value: AdminTenantStatusUpdateResponse) => void;
    mockUpdateTenantStatus.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMutation = resolve;
      })
    );

    renderPage();
    await waitFor(() => screen.getByTestId('mock-toggle-status-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-toggle-status-tenant-1'));

    const dialog = await screen.findByRole('alertdialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Suspender' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(confirmButton).toBeDisabled();
    });
    // Row actions are also disabled while any mutation is in flight (isMutating).
    expect(screen.getByTestId('mock-toggle-status-tenant-1')).toBeDisabled();
    expect(screen.getByTestId('mock-edit-limits-tenant-1')).toBeDisabled();

    resolveMutation(STATUS_SUCCESS_RESPONSE);

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });

  it('disables the save button while the limits mutation is pending', async () => {
    mockGetTenantList.mockResolvedValue(NON_EMPTY_RESPONSE);
    let resolveMutation!: (value: AdminTenantLimitsUpdateResponse) => void;
    mockUpdateTenantLimits.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMutation = resolve;
      })
    );

    renderPage();
    await waitFor(() => screen.getByTestId('mock-edit-limits-tenant-1'));
    fireEvent.click(screen.getByTestId('mock-edit-limits-tenant-1'));

    await screen.findByRole('dialog');
    const saveButton = screen.getByRole('button', { name: 'Guardar límites' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });

    resolveMutation(LIMITS_SUCCESS_RESPONSE);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
