import { describe, it, expect } from 'vitest'
import type { CommandActor } from '../admin-actor'

// ---------------------------------------------------------------------------
// T-06 — RED: shared toAuditActor mapper (Q1/Q5)
//
// Spec: platform-audit-log — Audit Actor Identity Carries a Display Label
// In-Payload (both actor-type scenarios)
//   - toAuditActor({type:'operator', operatorId}) → {id, type:'operator', label=id}
//   - toAuditActor({type:'user', userId}) → {id, type:'user', label=id}
//   - Pure function: no I/O, no imports beyond CommandActor
// ---------------------------------------------------------------------------

describe('toAuditActor', () => {
  it('maps an operator CommandActor to {id, type:"operator", label=id}', async () => {
    const { toAuditActor } = await import('../audit-actor.js')
    const actor: CommandActor = { type: 'operator', operatorId: 'op-1' }

    const result = toAuditActor(actor)

    expect(result).toEqual({ id: 'op-1', type: 'operator', label: 'op-1' })
  })

  it('maps a user CommandActor to {id, type:"user", label=id}', async () => {
    const { toAuditActor } = await import('../audit-actor.js')
    const actor: CommandActor = { type: 'user', userId: 'usr-1' }

    const result = toAuditActor(actor)

    expect(result).toEqual({ id: 'usr-1', type: 'user', label: 'usr-1' })
  })

  it('is deterministic — same input always maps to the same output (pure function, no I/O)', async () => {
    const { toAuditActor } = await import('../audit-actor.js')
    const actor: CommandActor = { type: 'operator', operatorId: 'op-2' }

    const first = toAuditActor(actor)
    const second = toAuditActor(actor)

    expect(first).toEqual(second)
  })
})
