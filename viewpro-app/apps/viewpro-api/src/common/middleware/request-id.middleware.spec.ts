import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { requestIdMiddleware } from './request-id.middleware'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const ATTACKER_REQUEST_ID = 'attacker-request-id'

type RequestFixture = { requestId?: string; header: (name: string) => string | undefined }

function buildRequest(incomingRequestId?: string): RequestFixture {
  return { header: () => incomingRequestId }
}

describe('requestIdMiddleware', () => {
  it('replaces an attacker-supplied x-request-id header in context and response headers', () => {
    const request = buildRequest(ATTACKER_REQUEST_ID)
    const response = { setHeader: vi.fn() }
    const next = vi.fn()

    requestIdMiddleware(request as unknown as Request, response as unknown as Response, next)

    expect(request.requestId).toMatch(UUID_V4)
    expect(request.requestId).not.toBe(ATTACKER_REQUEST_ID)
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId)
    expect(next).toHaveBeenCalledOnce()
  })

  it('replaces a well-formed inbound UUID so callers cannot pin the correlation ID', () => {
    const pinned = '11111111-1111-4111-8111-111111111111'
    const request = buildRequest(pinned)
    const response = { setHeader: vi.fn() }

    requestIdMiddleware(request as unknown as Request, response as unknown as Response, vi.fn())

    expect(request.requestId).toMatch(UUID_V4)
    expect(request.requestId).not.toBe(pinned)
  })

  it('generates a fresh canonical UUID v4 for every request', () => {
    const first = buildRequest()
    const second = buildRequest()
    const response = { setHeader: vi.fn() }

    requestIdMiddleware(first as unknown as Request, response as unknown as Response, vi.fn())
    requestIdMiddleware(second as unknown as Request, response as unknown as Response, vi.fn())

    expect(first.requestId).toMatch(UUID_V4)
    expect(second.requestId).toMatch(UUID_V4)
    expect(first.requestId).not.toBe(second.requestId)
  })

  it('keeps the response header identical to the request context identifier', () => {
    const request = buildRequest(ATTACKER_REQUEST_ID)
    const response = { setHeader: vi.fn() }

    requestIdMiddleware(request as unknown as Request, response as unknown as Response, vi.fn())

    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId)
  })
})
