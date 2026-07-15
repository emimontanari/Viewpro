import type { AuditActor } from '@viewpro/platform-contract' with { 'resolution-mode': 'require' }
import type { CommandActor } from './admin-actor'

// Q1/Q5: label = actor id, no cross-DB lookup — both emit sites share this mapper
// so status/limits produce byte-identical actor shapes.
export function toAuditActor(actor: CommandActor): AuditActor {
  return actor.type === 'operator'
    ? { id: actor.operatorId, type: 'operator', label: actor.operatorId }
    : { id: actor.userId, type: 'user', label: actor.userId }
}
