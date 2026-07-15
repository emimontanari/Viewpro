/**
 * T-21 — RED: useStepUpGate() hook tests (D11, D13)
 * Spec: operator-step-up-auth — Frontend Step-up Prompt for Destructive Actions
 *   (all 5 scenarios)
 *
 * Tests cover:
 *   - handleStepUpError(error, retry) with an isStepUpRequiredError error →
 *     returns true, dialogProps.open becomes true
 *   - handleStepUpError with a non-step-up error → returns false, dialog stays closed
 *   - Submitting the correct password (stepUp mocked resolved) → dialog closes,
 *     the stashed retry is invoked exactly once
 *   - Submitting a wrong password (stepUp mocked rejected 401) → dialog stays
 *     open, dialogProps.error is set, retry is NOT invoked, no logout side-effect
 *   - A second handleStepUpError call while the dialog is already open re-stashes
 *     the new retry (latest wins)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/session', () => ({
  stepUp: vi.fn()
}));

import { stepUp } from '@/lib/session';
import { useStepUpGate } from './use-step-up-gate';

const mockStepUp = vi.mocked(stepUp);

const STEP_UP_ERROR = { status: 403, code: 'STEP_UP_REQUIRED', message: 'Step-up verification required' };
const OTHER_ERROR = { status: 500, message: 'Error interno del servidor' };

beforeEach(() => {
  mockStepUp.mockReset();
});

describe('useStepUpGate — handleStepUpError', () => {
  it('opens the dialog and returns true for a STEP_UP_REQUIRED error', () => {
    const { result } = renderHook(() => useStepUpGate());
    const retry = vi.fn();

    let consumed = false;
    act(() => {
      consumed = result.current.handleStepUpError(STEP_UP_ERROR, retry);
    });

    expect(consumed).toBe(true);
    expect(result.current.dialogProps.open).toBe(true);
  });

  it('does not open the dialog and returns false for a non-step-up error', () => {
    const { result } = renderHook(() => useStepUpGate());
    const retry = vi.fn();

    let consumed = true;
    act(() => {
      consumed = result.current.handleStepUpError(OTHER_ERROR, retry);
    });

    expect(consumed).toBe(false);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('a second handleStepUpError call while the dialog is open re-stashes the new retry (latest wins)', async () => {
    mockStepUp.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useStepUpGate());
    const firstRetry = vi.fn();
    const secondRetry = vi.fn();

    act(() => {
      result.current.handleStepUpError(STEP_UP_ERROR, firstRetry);
    });
    act(() => {
      result.current.handleStepUpError(STEP_UP_ERROR, secondRetry);
    });

    await act(async () => {
      await result.current.dialogProps.onSubmit('secret1234');
    });

    expect(firstRetry).not.toHaveBeenCalled();
    expect(secondRetry).toHaveBeenCalledOnce();
  });
});

describe('useStepUpGate — onSubmit (correct password)', () => {
  it('closes the dialog and invokes the stashed retry exactly once', async () => {
    mockStepUp.mockResolvedValueOnce({ success: true });
    const { result } = renderHook(() => useStepUpGate());
    const retry = vi.fn();

    act(() => {
      result.current.handleStepUpError(STEP_UP_ERROR, retry);
    });
    expect(result.current.dialogProps.open).toBe(true);

    await act(async () => {
      await result.current.dialogProps.onSubmit('secret1234');
    });

    expect(mockStepUp).toHaveBeenCalledWith('secret1234');
    expect(retry).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(result.current.dialogProps.open).toBe(false);
    });
  });
});

describe('useStepUpGate — onSubmit (wrong password)', () => {
  it('keeps the dialog open, sets an inline error, does not retry, no logout side-effect', async () => {
    mockStepUp.mockRejectedValueOnce({ status: 401, message: 'Invalid password' });
    const { result } = renderHook(() => useStepUpGate());
    const retry = vi.fn();

    act(() => {
      result.current.handleStepUpError(STEP_UP_ERROR, retry);
    });

    await act(async () => {
      await result.current.dialogProps.onSubmit('wrong-password');
    });

    expect(result.current.dialogProps.open).toBe(true);
    expect(result.current.dialogProps.error).toBeTruthy();
    expect(retry).not.toHaveBeenCalled();
  });
});
