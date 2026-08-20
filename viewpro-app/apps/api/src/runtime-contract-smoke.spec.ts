import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertRuntimeContractStatus, runApiImageSmoke, runRuntimeContractSmoke } from './runtime-contract-smoke'

type ChildOptions = { closeCode?: number | null; closeOnSignal?: NodeJS.Signals; closeSignal?: NodeJS.Signals | null; exitCode?: number | null; exitOnSignal?: NodeJS.Signals; exitSignal?: NodeJS.Signals | null; stderr?: string; stdout?: string }
type FakeChild = EventEmitter & { kill: ReturnType<typeof vi.fn>; stderr: EventEmitter & { destroy: ReturnType<typeof vi.fn> }; stdout: EventEmitter & { destroy: ReturnType<typeof vi.fn> }; unref: ReturnType<typeof vi.fn> }

function child(options: ChildOptions = {}) {
  const process = new EventEmitter() as FakeChild
  process.stdout = Object.assign(new EventEmitter(), { destroy: vi.fn() })
  process.stderr = Object.assign(new EventEmitter(), { destroy: vi.fn() })
  process.unref = vi.fn()
  process.kill = vi.fn((signal: NodeJS.Signals) => {
    if (options.exitOnSignal === signal) queueMicrotask(() => process.emit('exit', options.exitCode ?? null, options.exitSignal ?? signal))
    if (options.closeOnSignal === signal) queueMicrotask(() => process.emit('close', options.closeCode ?? null, options.closeSignal ?? signal))
    return true
  })
  if ('closeCode' in options || options.closeSignal) process.stdout.once('newListener', event => {
    if (event !== 'data') return
    queueMicrotask(() => {
      if (options.stdout) process.stdout.emit('data', options.stdout)
      if (options.stderr) process.stderr.emit('data', options.stderr)
      process.emit('close', options.closeCode ?? 0, options.closeSignal ?? null)
    })
  })
  return process
}

function fixture(run = child(), token = 'test-token', cleanup = [child({ closeCode: 1, stderr: `Error: No such container: viewpro-runtime-smoke-${token}` })]) {
  const children = [
    child({ closeCode: 0, stdout: '["docker-entrypoint.sh"]' }),
    child({ closeCode: 0, stdout: '["node","dist/main.js"]' }), run,
    ...cleanup,
  ]
  const spawnProcess = vi.fn(() => children.shift()!)
  const verify = (options = {}) => runApiImageSmoke('viewpro-api-runtime-contract-smoke', { invocationToken: token, spawnProcess: spawnProcess as never, ...options })
  return { run, spawnProcess, verify }
}

function outcome(promise: Promise<unknown>) {
  const results: string[] = []
  void promise.then(() => results.push('resolved'), error => results.push(error.message))
  return results
}

function expectExitOnlyTeardown(run: FakeChild) {
  expect(run.stdout.destroy).toHaveBeenCalledOnce()
  expect(run.stderr.destroy).toHaveBeenCalledOnce()
  expect(run.unref).toHaveBeenCalledOnce()
  expect(run.stdout.destroy.mock.invocationCallOrder[0]!).toBeLessThan(run.stderr.destroy.mock.invocationCallOrder[0]!)
  expect(run.stderr.destroy.mock.invocationCallOrder[0]!).toBeLessThan(run.unref.mock.invocationCallOrder[0]!)
}

afterEach(() => vi.useRealTimers())

describe('runtime contract smoke', () => {
  it('imports the compiled contract through the one-shot seam', () => expect(runRuntimeContractSmoke()).toBe('not-generated-yet'))
  it('rejects a contract status other than the emitted runtime value', () => expect(() => assertRuntimeContractStatus('unexpected')).toThrow('runtime_contract_invalid'))

  it('inspects inherited config and overrides only the invocation command', async () => {
    const { run, spawnProcess, verify } = fixture(child({ closeCode: 0, stdout: 'complete' }), 'api-smoke-42')
    await expect(verify()).resolves.toBeUndefined()
    expect(run.stdout.destroy).not.toHaveBeenCalled()
    expect(run.stderr.destroy).not.toHaveBeenCalled()
    expect(run.unref).not.toHaveBeenCalled()
    expect(spawnProcess.mock.calls).toEqual([
      ['docker', ['image', 'inspect', '--format={{json .Config.Entrypoint}}', 'viewpro-api-runtime-contract-smoke']],
      ['docker', ['image', 'inspect', '--format={{json .Config.Cmd}}', 'viewpro-api-runtime-contract-smoke']],
      ['docker', ['run', '--rm', '--name', 'viewpro-runtime-smoke-api-smoke-42', '--label', 'com.viewpro.runtime-contract-smoke=api-smoke-42', 'viewpro-api-runtime-contract-smoke', 'node', 'dist/runtime-contract-smoke.js']],
      ['docker', ['container', 'inspect', '--format={{json .Config.Labels}}', 'viewpro-runtime-smoke-api-smoke-42']],
    ])
  })

  it.each([['spawn', () => { throw new Error('spawn failed') }], ['nonzero exit', () => child({ closeCode: 1 })], ['signal exit', () => child({ closeSignal: 'SIGTERM' })]])('rejects a %s failure', async (_label, firstChild) => {
    await expect(runApiImageSmoke('viewpro-api-runtime-contract-smoke', { spawnProcess: firstChild as never })).rejects.toThrow('runtime_smoke_failed')
  })

  it('settles once after a SIGTERM-cooperative exit without SIGKILL', async () => {
    vi.useFakeTimers()
    const { run, verify } = fixture(child({ exitOnSignal: 'SIGTERM' }))
    const results = outcome(verify({ timeoutMs: 10, killGraceMs: 5, finalEvidenceMs: 3 }))
    await vi.advanceTimersByTimeAsync(20)
    expect(run.kill).toHaveBeenCalledWith('SIGTERM')
    expect(run.kill).not.toHaveBeenCalledWith('SIGKILL')
    expect(results).toEqual(['runtime_smoke_failed'])
    expectExitOnlyTeardown(run)
  })

  it('settles a SIGKILL exit without waiting for close', async () => {
    vi.useFakeTimers()
    const { run, verify } = fixture(child({ exitOnSignal: 'SIGKILL' }))
    const results = outcome(verify({ timeoutMs: 10, killGraceMs: 5, finalEvidenceMs: 3 }))
    await vi.advanceTimersByTimeAsync(20)
    expect(run.kill).toHaveBeenCalledWith('SIGKILL')
    expect(results).toEqual(['runtime_smoke_failed'])
    expectExitOnlyTeardown(run)
  })

  it('bounds missing terminal evidence without claiming reaping or orphan absence', async () => {
    vi.useFakeTimers()
    const { run, verify } = fixture()
    const results = outcome(verify({ timeoutMs: 10, killGraceMs: 5, finalEvidenceMs: 3 }))
    await vi.advanceTimersByTimeAsync(20)
    expect(results).toEqual(['runtime_smoke_termination_unconfirmed'])
    expectExitOnlyTeardown(run)
  })

  it('settles once when exit is followed by duplicate close and late error', async () => {
    vi.useFakeTimers()
    const { run, verify } = fixture()
    const results = outcome(verify({ finalEvidenceMs: 3 }))
    await vi.advanceTimersByTimeAsync(3)
    run.emit('exit', 1, null)
    run.emit('close', 1, null)
    run.emit('close', 1, null)
    run.emit('error', new Error('late'))
    await vi.runAllTimersAsync()
    expect(results).toEqual(['runtime_smoke_failed'])
  })

  it('requires close for natural success and bounds exit-only stdio', async () => {
    vi.useFakeTimers()
    const { run, verify } = fixture()
    const results = outcome(verify({ finalEvidenceMs: 3 }))
    await vi.advanceTimersByTimeAsync(3)
    run.emit('exit', 0, null)
    await vi.advanceTimersByTimeAsync(3)
    expect(results).toEqual(['runtime_smoke_stdio_unclosed'])
    expectExitOnlyTeardown(run)
  })

  it('removes only the matching named container after a timed-out run', async () => {
    vi.useFakeTimers()
    const run = child({ closeOnSignal: 'SIGKILL' })
    const { spawnProcess, verify } = fixture(run, 'cleanup-42', [child({ closeCode: 0, stdout: '{"com.viewpro.runtime-contract-smoke":"cleanup-42"}' }), child({ closeCode: 0 })])
    const rejected = expect(verify({ timeoutMs: 10, killGraceMs: 5 })).rejects.toThrow('runtime_smoke_failed')
    await vi.advanceTimersByTimeAsync(20)
    await rejected
    expect(spawnProcess.mock.calls.slice(3)).toEqual([
      ['docker', ['container', 'inspect', '--format={{json .Config.Labels}}', 'viewpro-runtime-smoke-cleanup-42']],
      ['docker', ['rm', '--force', 'viewpro-runtime-smoke-cleanup-42']],
    ])
  })

  it('fails safely without removing a named container with a mismatched label', async () => {
    const run = child({ closeCode: 0 })
    const { spawnProcess, verify } = fixture(run, 'safe-42', [child({ closeCode: 0, stdout: '{"com.viewpro.runtime-contract-smoke":"foreign"}' })])
    await expect(verify()).rejects.toThrow('runtime_smoke_failed')
    expect(spawnProcess.mock.calls).toHaveLength(4)
  })
})
