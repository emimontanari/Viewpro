import { hasErrorCode, isBffError, messageFor } from '@/lib/bff-client';

/**
 * Copy this app owns for the three conflicts the property screens can hit.
 *
 * Each of these endpoints raises exactly one 409, which is why the status is
 * enough to identify it:
 *
 * - link-property-owner  -> 'Owner is already linked to this property'
 * - assign-property-agent -> 'Agent is already assigned to this property engagement'
 * - saving a property     -> the tenant's active property limit
 *
 * All three used to be found by searching the backend's English sentence for a
 * substring, so a reword on the server silently replaced this copy with that
 * sentence. If one of these endpoints ever grows a second conflict, these tests
 * are where that shows up — a status is a weaker key than a code, and the
 * catalogue has no code for these yet.
 */
export function ownerLinkErrorMessage(error: unknown): string {
  if (isBffError(error) && error.status === 409) {
    return 'Ese propietario ya está vinculado a esta propiedad.';
  }

  return messageFor(error, 'No se pudo vincular el propietario.');
}

export function agentAssignmentErrorMessage(error: unknown, fallback: string): string {
  if (isBffError(error) && error.status === 409) {
    return 'El vendedor ya está asignado a esta propiedad.';
  }

  return messageFor(error, fallback);
}

export function primaryAgentMutationErrorMessage(error: unknown): string {
  if (hasErrorCode(error, 'PRIMARY_AGENT_CANDIDATE_INVALID')) {
    return 'El vendedor ya no puede ser principal para esta propiedad.';
  }

  if (hasErrorCode(error, 'PRIMARY_AGENT_STATE_CONFLICT')) {
    return 'La selección principal cambió. Actualizá la propiedad e intentá de nuevo.';
  }

  return 'No se pudo actualizar el vendedor principal.';
}

export const PROPERTY_LIMIT_REACHED_MESSAGE =
  'Alcanzaste el límite de propiedades activas del plan. Archivá una propiedad o contactá a soporte.';

/** True when saving a property failed because the tenant is at its active limit. */
export function isPropertyLimitReached(error: unknown): boolean {
  return isBffError(error) && error.status === 409;
}
