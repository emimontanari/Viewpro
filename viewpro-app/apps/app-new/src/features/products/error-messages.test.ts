import { BffError } from '@/lib/bff-client';
import { describe, expect, it } from 'vitest';
import { primaryAgentMutationErrorMessage } from './error-messages';

describe('primary agent mutation errors', () => {
  it('uses safe local copy for an invalid candidate code', () => {
    expect(primaryAgentMutationErrorMessage(new BffError(400, 'PRIMARY_AGENT_CANDIDATE_INVALID'))).toBe(
      'El vendedor ya no puede ser principal para esta propiedad.'
    );
  });

  it('uses safe local copy for a stale primary state conflict', () => {
    expect(primaryAgentMutationErrorMessage(new BffError(409, 'PRIMARY_AGENT_STATE_CONFLICT'))).toBe(
      'La selección principal cambió. Actualizá la propiedad e intentá de nuevo.'
    );
  });

  it('does not expose backend prose for unrecognised failures', () => {
    expect(primaryAgentMutationErrorMessage(new Error('backend details must not reach operators'))).toBe(
      'No se pudo actualizar el vendedor principal.'
    );
  });
});
