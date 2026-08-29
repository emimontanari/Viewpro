import { describe, expect, it } from 'vitest';
import { BffError } from '@/lib/bff-client';
import {
  agentAssignmentErrorMessage,
  isPropertyLimitReached,
  ownerLinkErrorMessage
} from '../error-messages';

describe('ownerLinkErrorMessage', () => {
  it('names the one conflict this endpoint has, from its status', () => {
    expect(ownerLinkErrorMessage(new BffError(409))).toBe(
      'Ese propietario ya está vinculado a esta propiedad.'
    );
  });

  it('does not claim "already linked" for any other failure', () => {
    expect(ownerLinkErrorMessage(new BffError(403))).toBe('No se pudo vincular el propietario.');
    expect(ownerLinkErrorMessage(new BffError(500))).toBe('No se pudo vincular el propietario.');
  });

  it('never repeats a backend sentence, even one that says "already linked"', () => {
    // The old implementation matched that substring. A BffError carries the
    // generic message, so there is nothing to repeat — but assert it, because
    // this is the exact regression the migration exists to prevent.
    const error = new BffError(500);

    expect(ownerLinkErrorMessage(error)).not.toContain('already linked');
  });
});

describe('agentAssignmentErrorMessage', () => {
  it('names the one conflict this endpoint has', () => {
    expect(agentAssignmentErrorMessage(new BffError(409), 'fallback')).toBe(
      'El vendedor ya está asignado a esta propiedad.'
    );
  });

  it('uses the caller fallback for anything else', () => {
    expect(agentAssignmentErrorMessage(new BffError(404), 'No se pudo asignar.')).toBe(
      'No se pudo asignar.'
    );
  });
});

describe('isPropertyLimitReached', () => {
  it('is the 409 on the save path, and nothing else', () => {
    expect(isPropertyLimitReached(new BffError(409))).toBe(true);
    expect(isPropertyLimitReached(new BffError(422))).toBe(false);
    expect(isPropertyLimitReached(new Error('Tenant active property engagement limit exceeded'))).toBe(
      false
    );
  });
});
