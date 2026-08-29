export type ApiContractStatus = 'not-generated-yet'

export const apiContractStatus: ApiContractStatus = 'not-generated-yet'

export const PUBLIC_ERROR_CODES = [
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
  'REQUEST_FAILED',
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
  'phone.required',
  'phone.invalid',
  'phone.country_unsupported',
] as const

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number]

export type PublicErrorEnvelope = {
  statusCode: number
  errorCode: PublicErrorCode
  requestId: string
}

export function isPublicErrorCode(value: unknown): value is PublicErrorCode {
  return typeof value === 'string' && (PUBLIC_ERROR_CODES as readonly string[]).includes(value)
}
