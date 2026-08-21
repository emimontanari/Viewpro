import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifestPath = resolve(process.cwd(), '../../scripts/production-cutover/remediation-manifest.v1.json')

async function readManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8')) as Record<string, unknown>
}

describe('WU1/WU2 remediation manifest', () => {
  it('contains only the exact reviewed, review-bound authority contract', async () => {
    expect(await readManifest()).toEqual({
      schemaVersion: 1,
      kind: 'remediation-manifest',
      remediationScope: {
        gates: ['WU3-WU7 implementation', 'WU3-WU7 compatibility'],
        denies: ['provider mutation', 'D.4', 'candidate promotion', 'traffic', 'production receipts'],
      },
      receipts: {
        wu1: { status: 'reviewed-develop-merged', reviewedDevelopMerge: 'faf870ab0a29e6a271b7391776fc2f9cf25c12ac', implementationReceipt: 'openspec/changes/neon-clean-production-cutover/apply-progress.md' },
        wu2: { status: 'candidate-awaits-review', candidateBranch: 'fix/neon-clean-production-cutover-wu2', reviewedDevelopMerge: null, reviewBoundary: 'Independent review and a develop merge are required; this file grants no authority.' },
      },
    })
  })
})
