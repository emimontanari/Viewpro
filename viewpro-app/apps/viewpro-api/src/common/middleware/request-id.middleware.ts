import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

export function requestIdMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
) {
  // Always server-owned: an inbound x-request-id is attacker-controlled, so it
  // is discarded rather than trusted. Pinning or forging a correlation ID would
  // let a caller collide traces the moment this value reaches logs, telemetry,
  // or an error body.
  const requestId = randomUUID()

  request.requestId = requestId
  response.setHeader('x-request-id', requestId)

  next()
}
