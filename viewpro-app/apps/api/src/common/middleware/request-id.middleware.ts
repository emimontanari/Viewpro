import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function requestIdMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
) {
  const incomingRequestId = request.header('x-request-id')
  const requestId = incomingRequestId?.trim() || randomUUID()

  request.requestId = requestId
  response.setHeader('x-request-id', requestId)

  next()
}
