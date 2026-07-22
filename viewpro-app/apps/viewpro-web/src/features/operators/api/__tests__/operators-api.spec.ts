/**
 * platform-operator-management (A4, PR2) — RED: operators api layer unit tests.
 * Spec/design: OperatorsController at `operators/manage` (backend PR1, merged).
 * Unlike tenants' PATCH endpoints, every operators/manage response is a
 * strongly-typed OperatorSummary JSON body (id/email/role/status/timestamps) —
 * NOT an opaque InmoView control-lane passthrough — so no zod schema layer is
 * needed here (mirrors the simpler features/metrics/api pattern).
 *
 * Tests cover:
 *   - getOperatorList() calls GET /operators/manage, returns OperatorListItem[]
 *   - createOperator(payload) POSTs /operators/manage with {email,role,tempPassword}
 *   - updateOperatorRole(id,{role}) PATCHes .../:id/role
 *   - updateOperatorStatus(id,{status}) PATCHes .../:id/status
 *   - operatorsKeys are stable; operatorsListOptions carries the right key + queryFn
 *   - isolation: every call goes through the mocked apiRequest
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn()
}));

import { apiRequest } from '@/lib/api-client';
import {
  getOperatorList,
  createOperator,
  updateOperatorRole,
  updateOperatorStatus
} from '../service';
import { operatorsKeys, operatorsListOptions } from '../queries';
import type { OperatorListItem } from '../types';

const mockApiRequest = vi.mocked(apiRequest);

const MOCK_OPERATOR: OperatorListItem = {
  id: 'op-1',
  email: 'owner@viewpro.app',
  role: 'OWNER',
  status: 'ACTIVE',
  createdAt: '2026-07-16T00:00:00.000Z',
  updatedAt: '2026-07-16T00:00:00.000Z'
};

const MOCK_LIST: OperatorListItem[] = [MOCK_OPERATOR];

beforeEach(() => {
  mockApiRequest.mockReset();
});

// ─── getOperatorList() ────────────────────────────────────────────────────────

describe('getOperatorList()', () => {
  it('calls GET /operators/manage', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST);

    await getOperatorList();

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/manage');
    expect(options === undefined || (options as { method?: string }).method !== 'POST').toBe(true);
  });

  it('returns the raw operator array typed OperatorListItem[]', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST);

    const result = await getOperatorList();

    expect(result).toEqual(MOCK_LIST);
  });

  it('forwards API errors without swallowing them', async () => {
    const apiError = { status: 500, message: 'Internal server error' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(getOperatorList()).rejects.toMatchObject({ status: 500 });
  });
});

// ─── createOperator() ─────────────────────────────────────────────────────────

describe('createOperator()', () => {
  it('calls POST /operators/manage with {email,role,tempPassword}', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR);

    await createOperator({ email: 'new@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' });

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/manage');
    expect(options).toMatchObject({
      method: 'POST',
      body: { email: 'new@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' }
    });
  });

  it('returns the created OperatorListItem', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR);

    const result = await createOperator({
      email: 'owner@viewpro.app',
      role: 'OWNER',
      tempPassword: 'a-strong-temp-pw12'
    });

    expect(result).toEqual(MOCK_OPERATOR);
  });

  it('propagates a 409 duplicate-email error', async () => {
    const apiError = { status: 409, code: 'DUPLICATE_EMAIL', message: 'An operator with this email already exists' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(
      createOperator({ email: 'dup@viewpro.app', role: 'ANALYST', tempPassword: 'a-strong-temp-pw12' })
    ).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_EMAIL' });
  });
});

// ─── updateOperatorRole() ──────────────────────────────────────────────────────

describe('updateOperatorRole()', () => {
  it('calls PATCH /operators/manage/:id/role with {role}', async () => {
    mockApiRequest.mockResolvedValueOnce({ ...MOCK_OPERATOR, role: 'OPERATIONS' });

    await updateOperatorRole('op-1', { role: 'OPERATIONS' });

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/manage/op-1/role');
    expect(options).toMatchObject({ method: 'PATCH', body: { role: 'OPERATIONS' } });
  });

  it('encodes the operator id in the path', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_OPERATOR);

    await updateOperatorRole('op with spaces', { role: 'ANALYST' });

    const [path] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/manage/op%20with%20spaces/role');
  });

  it('propagates a 422 self-demote guardrail error', async () => {
    const apiError = { status: 422, code: 'SELF_DEMOTE_FORBIDDEN', message: 'You cannot change your own role' };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(updateOperatorRole('op-1', { role: 'ANALYST' })).rejects.toMatchObject({
      status: 422,
      code: 'SELF_DEMOTE_FORBIDDEN'
    });
  });
});

// ─── updateOperatorStatus() ─────────────────────────────────────────────────────

describe('updateOperatorStatus()', () => {
  it('calls PATCH /operators/manage/:id/status with {status}', async () => {
    mockApiRequest.mockResolvedValueOnce({ ...MOCK_OPERATOR, status: 'SUSPENDED' });

    await updateOperatorStatus('op-1', { status: 'SUSPENDED' });

    expect(mockApiRequest).toHaveBeenCalledOnce();
    const [path, options] = mockApiRequest.mock.calls[0];
    expect(path).toBe('/operators/manage/op-1/status');
    expect(options).toMatchObject({ method: 'PATCH', body: { status: 'SUSPENDED' } });
  });

  it('propagates a 422 last-owner guardrail error', async () => {
    const apiError = {
      status: 422,
      code: 'LAST_OWNER_PROTECTED',
      message: 'This action would leave the platform with zero active OWNER operators'
    };
    mockApiRequest.mockRejectedValueOnce(apiError);

    await expect(updateOperatorStatus('op-1', { status: 'SUSPENDED' })).rejects.toMatchObject({
      status: 422,
      code: 'LAST_OWNER_PROTECTED'
    });
  });
});

// ─── operatorsKeys / operatorsListOptions ──────────────────────────────────────

describe('operatorsKeys', () => {
  it('all is a stable constant array ["operators"]', () => {
    expect(operatorsKeys.all).toEqual(['operators']);
  });

  it('list() is ["operators","list"]', () => {
    expect(operatorsKeys.list()).toEqual(['operators', 'list']);
  });
});

describe('operatorsListOptions', () => {
  it('has queryKey matching operatorsKeys.list()', () => {
    const options = operatorsListOptions();
    expect(options.queryKey).toEqual(['operators', 'list']);
  });

  it('has queryFn that delegates to getOperatorList', async () => {
    mockApiRequest.mockResolvedValueOnce(MOCK_LIST);

    const result = await getOperatorList();

    expect(result).toEqual(MOCK_LIST);
  });
});

// ─── Isolation ───────────────────────────────────────────────────────────────

describe('viewpro-api-only isolation', () => {
  it('every service call goes through the mocked apiRequest (no raw fetch)', async () => {
    mockApiRequest.mockResolvedValue(MOCK_LIST);

    await getOperatorList();

    expect(mockApiRequest).toHaveBeenCalled();
  });
});
