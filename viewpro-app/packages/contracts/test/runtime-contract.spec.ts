import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = join(packageRoot, 'dist')
const establishedPublicErrorCodes = [
  'phone.too_short',
  'DOCUMENT_DUPLICATE_APPROVED',
  'OUTCOME_LABEL_NOT_FOUND',
  'LABEL_NAME_COLLIDES_BUILTIN',
  'LABEL_ALREADY_DELETED',
  'RESOLUTION_COMMENT_REQUIRED',
  'SELF_APPROVAL_FORBIDDEN',
  'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED',
  'STATUS_CHANGE_REQUEST_SUPERSEDED',
  'NOT_ASSIGNED_TO_ENGAGEMENT',
  'ENGAGEMENT_ARCHIVED',
  'TARGET_STATUS_SAME_AS_CURRENT',
  'STATUS_CHANGE_REQUEST_ALREADY_PENDING',
] as const

const frozenPublicErrorCodes = [...establishedPublicErrorCodes, 'REQUEST_FAILED'] as const

const appendedPublicErrorCodes = [
  'SESSION_EXPIRED',
  'INVITATION_NOT_FOUND',
  'INVITATION_EXPIRED',
  'INVITATION_REVOKED',
  'INVITATION_ALREADY_ACCEPTED',
  'INVITATION_EMAIL_MISMATCH',
  'INVITATION_ALREADY_MEMBER',
  'INVITATION_EMAIL_ALREADY_REGISTERED',
  'TENANT_USER_LIMIT_EXCEEDED',
  'INVITATION_INVALID_CREDENTIALS',
  'AUTH_TOKEN_INVALID',
] as const

const expectedPublicErrorCodes = [...frozenPublicErrorCodes, ...appendedPublicErrorCodes] as const

function runNode(args: string[]) {
  return execFileSync(process.execPath, args, {
    cwd: packageRoot,
    encoding: 'utf8',
  })
}

describe('@viewpro/contracts runtime contract', () => {
  it('emits only the CommonJS runtime and declaration entries', () => {
    expect(readdirSync(distDirectory).sort()).toEqual(['index.d.ts', 'index.js'])
    expect(readFileSync(join(distDirectory, 'index.d.ts'), 'utf8')).toContain(
      "export type ApiContractStatus = 'not-generated-yet';",
    )
  })

  it('loads the preserved status symbol through require', () => {
    const output = runNode([
      '-e',
      "const contract = require('@viewpro/contracts'); process.stdout.write(JSON.stringify(contract.apiContractStatus));",
    ])

    expect(JSON.parse(output)).toBe('not-generated-yet')
  })

  it('loads the preserved status symbol through dynamic import', () => {
    const output = runNode([
      '--input-type=module',
      '-e',
      "const contract = await import('@viewpro/contracts'); process.stdout.write(JSON.stringify(contract.apiContractStatus));",
    ])

    expect(JSON.parse(output)).toBe('not-generated-yet')
  })

  it('preserves the append-only public error catalog through require', () => {
    const output = runNode([
      '-e',
      "const contract = require('@viewpro/contracts'); process.stdout.write(JSON.stringify({ codes: contract.PUBLIC_ERROR_CODES, accepted: contract.PUBLIC_ERROR_CODES.map(contract.isPublicErrorCode), unknown: contract.isPublicErrorCode('UNTRUSTED_CODE'), missing: contract.isPublicErrorCode(undefined) }));",
    ])
    const contract = JSON.parse(output) as {
      accepted: boolean[]
      codes: string[]
      missing: boolean
      unknown: boolean
    }

    expect(contract.codes).toEqual(expectedPublicErrorCodes)
    expect(contract.codes.slice(0, frozenPublicErrorCodes.length)).toEqual(
      frozenPublicErrorCodes,
    )
    expect(new Set(contract.codes).size).toBe(contract.codes.length)
    expect(contract.accepted).toEqual(expectedPublicErrorCodes.map(() => true))
    expect(contract.unknown).toBe(false)
    expect(contract.missing).toBe(false)
  })

  it('exports the catalog runtime guard and public envelope through dynamic import', () => {
    const output = runNode([
      '--input-type=module',
      '-e',
      "const contract = await import('@viewpro/contracts'); process.stdout.write(JSON.stringify({ codes: contract.PUBLIC_ERROR_CODES, accepted: contract.isPublicErrorCode('REQUEST_FAILED') }));",
    ])
    const declaration = readFileSync(join(distDirectory, 'index.d.ts'), 'utf8')

    expect(JSON.parse(output)).toEqual({ codes: expectedPublicErrorCodes, accepted: true })
    expect(declaration).toContain('export type PublicErrorCode =')
    expect(declaration).toContain('export type PublicErrorEnvelope =')
    expect(declaration).toContain('statusCode: number')
    expect(declaration).toContain('errorCode: PublicErrorCode')
    expect(declaration).toContain('requestId: string')
  })
})
