import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const distDirectory = join(packageRoot, 'dist')

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
})
