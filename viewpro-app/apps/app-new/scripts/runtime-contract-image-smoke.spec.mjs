import { describe, expect, it, vi } from 'vitest';
import { cleanup, stopContainer, waitForReady } from './runtime-contract-image-smoke.mjs';

describe('runtime contract image smoke', () => {
  it('accepts only a direct 200 readiness response and never follows redirects', async () => {
    const request = vi.fn().mockResolvedValueOnce({ status: 200 }).mockResolvedValue({ status: 302 });
    const now = vi.fn().mockReturnValueOnce(0).mockReturnValue(1);

    await expect(waitForReady('http://127.0.0.1/auth/sign-in', { isRunning: async () => true, request })).resolves.toBeUndefined();
    now.mockReset().mockReturnValueOnce(0).mockReturnValue(1);

    await expect(
      waitForReady('http://127.0.0.1/auth/sign-in', {
        deadlineMs: 1,
        isRunning: async () => true,
        now,
        request,
        sleep: async () => {}
      })
    ).rejects.toThrow('timed out waiting');

    expect(request).toHaveBeenCalledWith('http://127.0.0.1/auth/sign-in', expect.objectContaining({ redirect: 'manual' }));
  });

  it('fails before readiness when the standalone server exits', async () => {
    const request = vi.fn();

    await expect(waitForReady('http://127.0.0.1/auth/sign-in', { isRunning: async () => false, request })).rejects.toThrow(
      'standalone server exited before readiness'
    );
    expect(request).not.toHaveBeenCalled();
  });

  it('aborts an in-flight readiness request at the overall deadline', async () => {
    const request = vi.fn(
      (_url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))))
    );

    await expect(
      waitForReady('http://127.0.0.1/auth/sign-in', { deadlineMs: 5, isRunning: async () => true, request })
    ).rejects.toThrow('timed out waiting');
    expect(request.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('escalates teardown, then waits and reaps the container', async () => {
    const calls = [];
    const run = vi.fn(async (_command, args) => {
      calls.push(args);
      if (args[0] === 'stop') throw new Error('stop failed');
      return '';
    });

    await stopContainer('smoke-container', run);

    expect(calls).toEqual([
      ['stop', '-t', '5', 'smoke-container'],
      ['kill', 'smoke-container'],
      ['wait', 'smoke-container'],
      ['rm', 'smoke-container']
    ]);
  });

  it('reports cleanup failures after attempting token-scoped reaping', async () => {
    const run = vi.fn(async (_command, args) => {
      if (args[0] === 'rm' && args[1] === '-f') throw new Error('remove failed');
      return '';
    });

    await expect(cleanup('smoke-container', 'io.viewpro.sdd-attempt=token', run)).rejects.toThrow(
      'runtime smoke cleanup failed'
    );
    expect(run).toHaveBeenCalledWith('docker', ['ps', '-aq', '--filter', 'label=io.viewpro.sdd-attempt=token']);
  });
});
