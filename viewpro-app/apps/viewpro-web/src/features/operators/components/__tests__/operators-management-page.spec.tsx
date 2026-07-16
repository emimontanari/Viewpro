/**
 * platform-operator-management (A4, PR2) — RED: OperatorsManagementPage
 * container tests. Mirrors TenantsManagementPage's container pattern: owns
 * the list query, create/role/status mutations, and dialog state;
 * presentational children are props-in/callbacks-out.
 *
 * Tests cover:
 *   - Loading → skeleton (not an error)
 *   - Success with items>0 → OperatorsTable rendered
 *   - Success with items===0 → OperatorsEmptyState rendered instead
 *   - Error (non-401) → inline error card via getApiErrorMessage
 *   - "Nuevo operador" opens the real OperatorCreateDialog; submitting
 *     POSTs and refetches; 409 DUPLICATE_EMAIL surfaces as an INLINE dialog
 *     error (not a toast); every other create error is a toast
 *   - Changing role opens the real OperatorRoleDialog; submitting PATCHes
 *     role; a 422 guardrail error surfaces as a toast with the reason
 *   - Toggling to SUSPENDED opens the confirm dialog; confirming PATCHes
 *     status; toggling to ACTIVE (reactivate) PATCHes directly, no dialog
 *   - A 422 guardrail on status PATCH surfaces as a toast with the reason
 *   - A 403 STEP_UP_REQUIRED on any mutation opens the shared StepUpDialog
 *     and retries the ORIGINAL mutation on correct password
 *   - Double-submit guard: isMutating disables the table's row actions
 */

import * as React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { OperatorListItem } from '@/features/operators/api/types';

vi.mock('@/features/operators/api/service', () => ({
  getOperatorList: vi.fn(),
  createOperator: vi.fn(),
  updateOperatorRole: vi.fn(),
  updateOperatorStatus: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/lib/session', () => ({
  stepUp: vi.fn()
}));

type MockStatusAction = { targetStatus: string; label: string };

vi.mock('../operators-table', () => ({
  getOperatorStatusAction: (item: OperatorListItem): MockStatusAction =>
    item.status === 'ACTIVE'
      ? { targetStatus: 'SUSPENDED', label: 'Suspender' }
      : { targetStatus: 'ACTIVE', label: 'Reactivar' },
  OperatorsTable: ({
    items,
    isMutating,
    onChangeRole,
    onStatusAction
  }: {
    items: OperatorListItem[];
    isMutating: boolean;
    onChangeRole: (item: OperatorListItem) => void;
    onStatusAction: (item: OperatorListItem, action: MockStatusAction) => void;
  }) => (
    <div data-testid='operators-table'>
      {items.map((item) => (
        <div key={item.id}>
          <span data-testid={`mock-item-${item.id}`}>{item.email}</span>
          <button
            type='button'
            data-testid={`mock-change-role-${item.id}`}
            disabled={isMutating}
            onClick={() => onChangeRole(item)}
          >
            cambiar-rol-{item.id}
          </button>
          <button
            type='button'
            data-testid={`mock-status-action-${item.id}`}
            disabled={isMutating}
            onClick={() =>
              onStatusAction(
                item,
                item.status === 'ACTIVE'
                  ? { targetStatus: 'SUSPENDED', label: 'Suspender' }
                  : { targetStatus: 'ACTIVE', label: 'Reactivar' }
              )
            }
          >
            {item.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}-{item.id}
          </button>
        </div>
      ))}
    </div>
  )
}));

vi.mock('../operators-empty-state', () => ({
  OperatorsEmptyState: () => <div data-testid='operators-empty-state'>vacío</div>
}));

import {
  createOperator,
  getOperatorList,
  updateOperatorRole,
  updateOperatorStatus
} from '@/features/operators/api/service';
import { stepUp } from '@/lib/session';
import { OperatorsManagementPage } from '../operators-management-page';

const mockGetOperatorList = vi.mocked(getOperatorList);
const mockCreateOperator = vi.mocked(createOperator);
const mockUpdateOperatorRole = vi.mocked(updateOperatorRole);
const mockUpdateOperatorStatus = vi.mocked(updateOperatorStatus);
const mockToast = vi.mocked(toast);
const mockStepUp = vi.mocked(stepUp);

const STEP_UP_REQUIRED_ERROR = {
  status: 403,
  code: 'STEP_UP_REQUIRED',
  message: 'Step-up verification required'
};

const ACTIVE_OWNER: OperatorListItem = {
  id: 'op-1',
  email: 'owner@viewpro.app',
  role: 'OWNER',
  status: 'ACTIVE',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

const SUSPENDED_ANALYST: OperatorListItem = {
  id: 'op-2',
  email: 'analyst@viewpro.app',
  role: 'ANALYST',
  status: 'SUSPENDED',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

const NON_EMPTY_LIST: OperatorListItem[] = [ACTIVE_OWNER, SUSPENDED_ANALYST];
const EMPTY_LIST: OperatorListItem[] = [];

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OperatorsManagementPage />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('OperatorsManagementPage — loading state', () => {
  it('renders a skeleton while loading (not an error)', () => {
    mockGetOperatorList.mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByTestId('operators-loading-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('operators-error')).toBeNull();
  });
});

// ─── Success states ─────────────────────────────────────────────────────────

describe('OperatorsManagementPage — success with items', () => {
  it('renders OperatorsTable with the fetched items', async () => {
    mockGetOperatorList.mockResolvedValueOnce(NON_EMPTY_LIST);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('operators-table')).toBeTruthy();
    });
    expect(screen.getByTestId('mock-item-op-1').textContent).toBe('owner@viewpro.app');
    expect(screen.queryByTestId('operators-empty-state')).toBeNull();
  });
});

describe('OperatorsManagementPage — success with zero items', () => {
  it('renders OperatorsEmptyState instead of the table', async () => {
    mockGetOperatorList.mockResolvedValueOnce(EMPTY_LIST);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('operators-empty-state')).toBeTruthy();
    });
    expect(screen.queryByTestId('operators-table')).toBeNull();
  });
});

describe('OperatorsManagementPage — error state', () => {
  it('renders an inline error card on non-401 failure', async () => {
    const apiError = { status: 500, message: 'Error interno del servidor' };
    mockGetOperatorList.mockRejectedValueOnce(apiError);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('operators-error')).toBeTruthy();
    });
    expect(screen.getByTestId('operators-error').textContent).toContain('Error interno del servidor');
  });
});

// ─── Create operator ────────────────────────────────────────────────────────

describe('OperatorsManagementPage — create operator', () => {
  it('"Nuevo operador" opens the real OperatorCreateDialog', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);

    renderPage();
    await waitFor(() => screen.getByTestId('operators-table'));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
  });

  it('submitting the create dialog POSTs and refetches on success', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockCreateOperator.mockResolvedValueOnce({ ...ACTIVE_OWNER, id: 'op-3', email: 'new@viewpro.app' });

    renderPage();
    await waitFor(() => screen.getByTestId('operators-table'));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@viewpro.app' } });
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), {
      target: { value: 'a-strong-temp-pw12' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    await waitFor(() => {
      expect(mockCreateOperator).toHaveBeenCalledWith({
        email: 'new@viewpro.app',
        role: 'ANALYST',
        tempPassword: 'a-strong-temp-pw12'
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetOperatorList).toHaveBeenCalledTimes(2);
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('409 DUPLICATE_EMAIL surfaces as an INLINE dialog error, not a toast; dialog stays open', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockCreateOperator.mockRejectedValueOnce({
      status: 409,
      code: 'DUPLICATE_EMAIL',
      message: 'An operator with this email already exists'
    });

    renderPage();
    await waitFor(() => screen.getByTestId('operators-table'));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'dup@viewpro.app' } });
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), {
      target: { value: 'a-strong-temp-pw12' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    await waitFor(() => {
      expect(screen.getByText('Ese email ya está registrado.')).toBeTruthy();
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(mockToast.error).not.toHaveBeenCalled();
    expect(mockGetOperatorList).toHaveBeenCalledTimes(1);
  });

  it('a non-409 create error surfaces as a toast', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockCreateOperator.mockRejectedValueOnce({ status: 500, message: 'Error interno del servidor' });

    renderPage();
    await waitFor(() => screen.getByTestId('operators-table'));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@viewpro.app' } });
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), {
      target: { value: 'a-strong-temp-pw12' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Error interno del servidor');
    });
  });
});

// ─── Role change ────────────────────────────────────────────────────────────

describe('OperatorsManagementPage — role change', () => {
  it('clicking "cambiar rol" opens the real OperatorRoleDialog seeded from the row', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-change-role-op-1'));
    fireEvent.click(screen.getByTestId('mock-change-role-op-1'));

    await screen.findByRole('dialog');
    expect(screen.getByLabelText('Rol')).toHaveValue('OWNER');
  });

  it('submitting the role dialog PATCHes role and refetches on success', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorRole.mockResolvedValueOnce({ ...ACTIVE_OWNER, role: 'OPERATIONS' });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-change-role-op-1'));
    fireEvent.click(screen.getByTestId('mock-change-role-op-1'));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'OPERATIONS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));

    await waitFor(() => {
      expect(mockUpdateOperatorRole).toHaveBeenCalledWith('op-1', { role: 'OPERATIONS' });
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetOperatorList).toHaveBeenCalledTimes(2);
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('a 422 SELF_DEMOTE_FORBIDDEN guardrail surfaces a Spanish toast (not the English code)', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorRole.mockRejectedValueOnce({
      status: 422,
      code: 'SELF_DEMOTE_FORBIDDEN',
      message: 'You cannot change your own role'
    });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-change-role-op-1'));
    fireEvent.click(screen.getByTestId('mock-change-role-op-1'));

    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar rol' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('No podés cambiar tu propio rol.');
    });
    expect(mockGetOperatorList).toHaveBeenCalledTimes(1);
  });
});

// ─── Status toggle ──────────────────────────────────────────────────────────

describe('OperatorsManagementPage — status toggle', () => {
  it('toggling an ACTIVE row to SUSPENDED opens the confirm dialog; no PATCH yet', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(mockUpdateOperatorStatus).not.toHaveBeenCalled();
  });

  it('confirming the dialog PATCHes status:SUSPENDED; success refetches', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorStatus.mockResolvedValueOnce({ ...ACTIVE_OWNER, status: 'SUSPENDED' });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockUpdateOperatorStatus).toHaveBeenCalledWith('op-1', { status: 'SUSPENDED' });
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    await waitFor(() => {
      expect(mockGetOperatorList).toHaveBeenCalledTimes(2);
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('toggling a SUSPENDED row to ACTIVE (reactivate) PATCHes directly, no confirm dialog', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorStatus.mockResolvedValueOnce({ ...SUSPENDED_ANALYST, status: 'ACTIVE' });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-2'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-2'));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => {
      expect(mockUpdateOperatorStatus).toHaveBeenCalledWith('op-2', { status: 'ACTIVE' });
    });
  });

  it('a 422 LAST_OWNER_PROTECTED guardrail surfaces a Spanish toast (not the English code); dialog closes', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorStatus.mockRejectedValueOnce({
      status: 422,
      code: 'LAST_OWNER_PROTECTED',
      message: 'This action would leave the platform with zero active OWNER operators'
    });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'No se puede: debe quedar al menos un OWNER activo.'
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(mockGetOperatorList).toHaveBeenCalledTimes(1);
  });

  it('a 422 SELF_STATUS_CHANGE_FORBIDDEN guardrail surfaces a Spanish toast (not the English code); dialog closes', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorStatus.mockRejectedValueOnce({
      status: 422,
      code: 'SELF_STATUS_CHANGE_FORBIDDEN',
      message: 'You cannot change your own status'
    });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('No podés cambiar tu propio estado.');
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(mockGetOperatorList).toHaveBeenCalledTimes(1);
  });
});

// ─── Step-up gate wiring ────────────────────────────────────────────────────

describe('OperatorsManagementPage — step-up gate wiring', () => {
  it('a 403 STEP_UP_REQUIRED on status PATCH opens the shared StepUpDialog — no error toast', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorStatus.mockRejectedValueOnce(STEP_UP_REQUIRED_ERROR);

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('correct password retries the ORIGINAL status mutation; success closes both dialogs and refetches', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockUpdateOperatorStatus.mockRejectedValueOnce(STEP_UP_REQUIRED_ERROR);
    mockUpdateOperatorStatus.mockResolvedValueOnce({ ...ACTIVE_OWNER, status: 'SUSPENDED' });
    mockStepUp.mockResolvedValueOnce({ success: true });

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => screen.getByLabelText('Contraseña'));
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secret1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(mockUpdateOperatorStatus).toHaveBeenCalledTimes(2);
    });
    expect(mockUpdateOperatorStatus).toHaveBeenNthCalledWith(2, 'op-1', { status: 'SUSPENDED' });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
    expect(screen.queryByLabelText('Contraseña')).toBeNull();
    await waitFor(() => {
      expect(mockGetOperatorList).toHaveBeenCalledTimes(2);
    });
  });

  it('a 403 STEP_UP_REQUIRED on createOperator also opens the shared modal', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    mockCreateOperator.mockRejectedValueOnce(STEP_UP_REQUIRED_ERROR);

    renderPage();
    await waitFor(() => screen.getByTestId('operators-table'));
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo operador' }));

    await screen.findByRole('dialog');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@viewpro.app' } });
    fireEvent.change(screen.getByLabelText('Contraseña temporal'), {
      target: { value: 'a-strong-temp-pw12' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear operador' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Contraseña')).toBeTruthy();
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

// ─── Double-submit guard ────────────────────────────────────────────────────

describe('OperatorsManagementPage — double-submit guard', () => {
  it('disables the table row actions while a status mutation is pending', async () => {
    mockGetOperatorList.mockResolvedValue(NON_EMPTY_LIST);
    let resolveMutation!: (value: OperatorListItem) => void;
    mockUpdateOperatorStatus.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMutation = resolve;
      })
    );

    renderPage();
    await waitFor(() => screen.getByTestId('mock-status-action-op-1'));
    fireEvent.click(screen.getByTestId('mock-status-action-op-1'));

    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspender' }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-status-action-op-1')).toBeDisabled();
    });
    expect(screen.getByTestId('mock-change-role-op-1')).toBeDisabled();

    resolveMutation({ ...ACTIVE_OWNER, status: 'SUSPENDED' });

    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });
  });
});
