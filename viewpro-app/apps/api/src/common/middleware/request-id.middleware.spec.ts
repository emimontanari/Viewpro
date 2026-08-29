import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { requestIdMiddleware } from './request-id.middleware'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
type RequestFixture = { requestId?: string }

describe('requestIdMiddleware', () => {
  it('replaces an attacker-controlled request ID in context and response headers', () => {
    const request: RequestFixture = { requestId: 'attacker-request-id' }
    const response = { setHeader: vi.fn() }
    const next = vi.fn()

    requestIdMiddleware(request as Request, response as unknown as Response, next)

    expect(request.requestId).toMatch(UUID_V4)
    expect(request.requestId).not.toBe('attacker-request-id')
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', request.requestId)
    expect(next).toHaveBeenCalledOnce()
  })

  it('generates a fresh canonical UUID v4 for every request', () => {
    const first: RequestFixture = {}
    const second: RequestFixture = {}
    const response = { setHeader: vi.fn() }

    requestIdMiddleware(first as Request, response as unknown as Response, vi.fn())
    requestIdMiddleware(second as Request, response as unknown as Response, vi.fn())

    expect(first.requestId).toMatch(UUID_V4)
    expect(second.requestId).toMatch(UUID_V4)
    expect(first.requestId).not.toBe(second.requestId)
  })
})
