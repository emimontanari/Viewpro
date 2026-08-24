import type { PublicErrorEnvelope } from '@viewpro/contracts'

export type ApiErrorResponse = PublicErrorEnvelope | {
  statusCode: number
  error: string
  message: string | string[]
  errorCode?: string
  path: string
  timestamp: string
  requestId?: string
}
