import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { apiContractStatus } from '@viewpro/contracts'

const EXPECTED_ENTRYPOINT = ['docker-entrypoint.sh']
const EXPECTED_COMMAND = ['node', 'dist/main.js']
const SMOKE_COMMAND = ['node', 'dist/runtime-contract-smoke.js']
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_KILL_GRACE_MS = 1_000
const DEFAULT_FINAL_EVIDENCE_MS = 1_000

type SpawnProcess = (command: string, args: string[]) => ChildProcess

type ImageSmokeOptions = {
  invocationToken?: string
  finalEvidenceMs?: number
  killGraceMs?: number
  spawnProcess?: SpawnProcess
  timeoutMs?: number
}

type CommandResult = {
  code: number | null
  output: string
}

function smokeFailure(message = 'runtime_smoke_failed') {
  return new Error(message)
}

function runCommand(
  command: string,
  args: string[],
  { spawnProcess = spawn, timeoutMs = DEFAULT_TIMEOUT_MS, killGraceMs = DEFAULT_KILL_GRACE_MS, finalEvidenceMs = DEFAULT_FINAL_EVIDENCE_MS }: ImageSmokeOptions,
  allowNonZero = false,
) {
  return new Promise<CommandResult>((resolve, reject) => {
    let child: ChildProcess
    try {
      child = spawnProcess(command, args)
    } catch {
      reject(smokeFailure())
      return
    }

    let output = ''
    let settled = false
    let timedOut = false
    let exited = false
    let grace: NodeJS.Timeout | undefined
    let evidence: NodeJS.Timeout | undefined
    const release = () => {
      clearTimeout(timeout)
      clearTimeout(grace)
      clearTimeout(evidence)
      child.removeListener('exit', onExit)
      child.removeListener('close', onClose)
    }
    const finish = (failure?: Error, result?: CommandResult, teardown = false) => {
      if (settled) return
      settled = true
      release()
      if (teardown) {
        child.stdout?.destroy()
        child.stderr?.destroy()
        child.unref()
      }
      if (failure) reject(failure)
      else resolve(result!)
    }
    const abandon = () => finish(smokeFailure('runtime_smoke_termination_unconfirmed'), undefined, true)
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      grace = setTimeout(() => {
        if (settled || exited) return
        child.kill('SIGKILL')
        evidence = setTimeout(abandon, finalEvidenceMs)
      }, killGraceMs)
    }, timeoutMs)
    const onError = () => {
      if (!timedOut) finish(smokeFailure(), undefined, true)
    }
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (exited) return
      exited = true
      if (timedOut || (!allowNonZero && (code !== 0 || signal !== null))) return finish(smokeFailure(), undefined, true)
      evidence = setTimeout(() => finish(smokeFailure('runtime_smoke_stdio_unclosed'), undefined, true), finalEvidenceMs)
    }
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      finish(timedOut || (!allowNonZero && (code !== 0 || signal !== null)) ? smokeFailure() : undefined, { code, output })
    }

    child.stdout?.on('data', (chunk: Buffer | string) => {
      output += chunk.toString()
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      output += chunk.toString()
    })
    child.on('error', onError)
    child.once('exit', onExit)
    child.once('close', onClose)
  })
}

function assertExactImageConfig(output: string, expected: string[]) {
  try {
    const actual: unknown = JSON.parse(output)
    if (!Array.isArray(actual) || actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
      throw smokeFailure()
    }
  } catch {
    throw smokeFailure()
  }
}

export function assertRuntimeContractStatus(status: string) {
  if (status !== 'not-generated-yet') throw new Error('runtime_contract_invalid')
  return status
}

export function runRuntimeContractSmoke() {
  return assertRuntimeContractStatus(apiContractStatus)
}

async function cleanupContainer(name: string, token: string, options: ImageSmokeOptions) {
  const inspection = await runCommand(
    'docker',
    ['container', 'inspect', '--format={{json .Config.Labels}}', name],
    options,
    true,
  )
  if (inspection.code !== 0) {
    if (inspection.output.includes('No such container')) return
    throw smokeFailure()
  }

  try {
    const labels = JSON.parse(inspection.output) as Record<string, unknown>
    if (labels['com.viewpro.runtime-contract-smoke'] !== token) throw smokeFailure()
  } catch {
    throw smokeFailure()
  }

  await runCommand('docker', ['rm', '--force', name], options)
}

export async function runApiImageSmoke(image: string, options: ImageSmokeOptions = {}) {
  const token = options.invocationToken ?? randomUUID()
  const name = `viewpro-runtime-smoke-${token}`
  try {
    const entrypoint = await runCommand('docker', ['image', 'inspect', '--format={{json .Config.Entrypoint}}', image], options)
    assertExactImageConfig(entrypoint.output, EXPECTED_ENTRYPOINT)

    const command = await runCommand('docker', ['image', 'inspect', '--format={{json .Config.Cmd}}', image], options)
    assertExactImageConfig(command.output, EXPECTED_COMMAND)

    await runCommand('docker', ['run', '--rm', '--name', name, '--label', `com.viewpro.runtime-contract-smoke=${token}`, image, ...SMOKE_COMMAND], options)
  } finally {
    await cleanupContainer(name, token, options)
  }
}

async function main() {
  try {
    const image = process.env.VIEWPRO_RUNTIME_SMOKE_IMAGE
    if (image) await runApiImageSmoke(image)
    else runRuntimeContractSmoke()
  } catch {
    process.exitCode = 1
  }
}

if (require.main === module) void main()
