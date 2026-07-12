export type ApiErrorResponse = {
  statusCode: number
  error: string
  message: string | string[]
  errorCode?: string
  path: string
  timestamp: string
  requestId?: string
}
