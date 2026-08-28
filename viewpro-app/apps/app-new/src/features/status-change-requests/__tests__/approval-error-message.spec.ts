import { describe, expect, it } from 'vitest';
import { BffError } from '@/lib/bff-client';
import {
  APPROVAL_FALLBACK_MESSAGE,
  approvalErrorMessage,
  CREATION_FALLBACK_MESSAGE,
  creationErrorMessage
} from '../approval-error-message';

describe('approvalErrorMessage', () => {
  it('explains a superseded request from its code, not from the server sentence', () => {
    const error = new BffError(409, 'STATUS_CHANGE_REQUEST_SUPERSEDED');

    expect(approvalErrorMessage(error)).toContain('cambió desde que se creó');
  });

  it('explains an already-resolved request from its code', () => {
    const error = new BffError(409, 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED');

    expect(approvalErrorMessage(error)).toBe('Esta solicitud ya fue resuelta.');
  });

  it('does not claim the request was superseded just because a sentence says "changed"', () => {
    // The previous implementation matched `message.includes('changed')`, so an
    // unrelated failure whose prose happened to contain that word was reported
    // to the operator as a superseded request. It is the substring that is the
    // bug, not the wording: no sentence can be trusted to classify a failure.
    const unrelated = new Error('The upstream password was changed');

    expect(approvalErrorMessage(unrelated)).toBe(APPROVAL_FALLBACK_MESSAGE);
  });

  it('falls back for a code it does not have specific copy for', () => {
    const error = new BffError(409, 'STATUS_CHANGE_REQUEST_ALREADY_PENDING');

    expect(approvalErrorMessage(error)).toBe(APPROVAL_FALLBACK_MESSAGE);
  });

  it('falls back for something that is not an error at all', () => {
    expect(approvalErrorMessage(undefined)).toBe(APPROVAL_FALLBACK_MESSAGE);
  });
});

describe('creationErrorMessage', () => {
  it.each([
    ['NOT_ASSIGNED_TO_ENGAGEMENT', 'No estás asignado'],
    ['ENGAGEMENT_ARCHIVED', 'archivada'],
    ['TARGET_STATUS_SAME_AS_CURRENT', 'ya tiene ese estado'],
    ['STATUS_CHANGE_REQUEST_ALREADY_PENDING', 'solicitud pendiente']
  ] as const)('explains %s in copy this app owns', (code, fragment) => {
    expect(creationErrorMessage(new BffError(409, code))).toContain(fragment);
  });

  it('gives every catalogued creation code its own distinct sentence', () => {
    const codes = [
      'NOT_ASSIGNED_TO_ENGAGEMENT',
      'ENGAGEMENT_ARCHIVED',
      'TARGET_STATUS_SAME_AS_CURRENT',
      'STATUS_CHANGE_REQUEST_ALREADY_PENDING'
    ] as const;
    const sentences = codes.map((code) => creationErrorMessage(new BffError(409, code)));

    // Distinct, and none of them silently the fallback: a mapper that returns
    // the same generic for two codes reads as covered while helping nobody.
    expect(new Set(sentences).size).toBe(codes.length);
    expect(sentences).not.toContain(CREATION_FALLBACK_MESSAGE);
  });

  it('falls back rather than inventing copy for an unmapped failure', () => {
    expect(creationErrorMessage(new BffError(500))).toBe(CREATION_FALLBACK_MESSAGE);
    expect(creationErrorMessage(new Error('archived'))).toBe(CREATION_FALLBACK_MESSAGE);
  });
});

