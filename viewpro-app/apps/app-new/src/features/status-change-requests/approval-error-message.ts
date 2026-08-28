import { hasErrorCode, type PublicErrorCode } from '@/lib/bff-client';

export const APPROVAL_FALLBACK_MESSAGE = 'No se pudo aprobar la solicitud.';

/**
 * Copy this app owns, chosen by the catalogued error code.
 *
 * This used to read the backend's sentence and match substrings against it
 * ('SUPERSEDED', 'changed', 'already resolved'). Two things were wrong with
 * that: the operator could be shown prose written for a server log, and any
 * unrelated failure whose wording happened to contain 'changed' was reported
 * as a superseded request. A code is a contract; a sentence is not.
 */
export function approvalErrorMessage(error: unknown): string {
  if (hasErrorCode(error, 'STATUS_CHANGE_REQUEST_SUPERSEDED')) {
    return 'El estado de la propiedad cambió desde que se creó esta solicitud. Revisá antes de aprobar.';
  }

  if (hasErrorCode(error, 'STATUS_CHANGE_REQUEST_ALREADY_RESOLVED')) {
    return 'Esta solicitud ya fue resuelta.';
  }

  return APPROVAL_FALLBACK_MESSAGE;
}

export const CREATION_FALLBACK_MESSAGE = 'No se pudo enviar la solicitud.';

const CREATION_MESSAGES: ReadonlyArray<readonly [PublicErrorCode, string]> = [
  [
    'NOT_ASSIGNED_TO_ENGAGEMENT',
    'No estás asignado a esta propiedad, así que no podés pedir un cambio de estado.'
  ],
  ['ENGAGEMENT_ARCHIVED', 'Esta propiedad está archivada y ya no admite cambios de estado.'],
  ['TARGET_STATUS_SAME_AS_CURRENT', 'La propiedad ya tiene ese estado.'],
  [
    'STATUS_CHANGE_REQUEST_ALREADY_PENDING',
    'Ya hay una solicitud pendiente para esta propiedad. Esperá a que se resuelva.'
  ]
];

/** Same contract as {@link approvalErrorMessage}, for the creation path. */
export function creationErrorMessage(error: unknown): string {
  const match = CREATION_MESSAGES.find(([code]) => hasErrorCode(error, code));
  return match ? match[1] : CREATION_FALLBACK_MESSAGE;
}
