import { afterEach, describe, expect, it, vi } from 'vitest';
import { bffRequest, getLatestApplicationRequestId } from '@/lib/bff-client';
import { submitFeedback } from './service';

vi.mock('@/lib/bff-client', () => ({
  bffRequest: vi.fn(),
  getLatestApplicationRequestId: vi.fn()
}));

const bffRequestMock = vi.mocked(bffRequest);
const getLatestApplicationRequestIdMock = vi.mocked(getLatestApplicationRequestId);

describe('feedback API service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives the pathname and forwards only the typed feedback fields', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard/properties' }
    });
    bffRequestMock.mockResolvedValueOnce({ accepted: true });
    getLatestApplicationRequestIdMock.mockReturnValueOnce(undefined);

    await expect(
      submitFeedback({ type: 'ERROR', description: 'La carga no funciona.' })
    ).resolves.toEqual({ accepted: true });

    expect(bffRequestMock).toHaveBeenCalledWith('/api/feedback', {
      body: JSON.stringify({
        type: 'ERROR',
        description: 'La carga no funciona.',
        pathname: '/dashboard/properties'
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

  it('forwards only the latest request ID proven by the BFF client', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard' }
    });
    bffRequestMock.mockResolvedValueOnce({ accepted: true });
    getLatestApplicationRequestIdMock.mockReturnValueOnce('01234567-89ab-4cde-8fab-0123456789ab');

    await submitFeedback({ type: 'SUGGESTION', description: 'Agregar un filtro útil.' });

    expect(bffRequestMock).toHaveBeenCalledWith('/api/feedback', {
      body: JSON.stringify({
        type: 'SUGGESTION',
        description: 'Agregar un filtro útil.',
        pathname: '/dashboard',
        requestId: '01234567-89ab-4cde-8fab-0123456789ab'
      }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    });
  });

  it('does not expose a request ID argument in the feedback service', () => {
    expect(submitFeedback).toHaveLength(1);
  });
});
