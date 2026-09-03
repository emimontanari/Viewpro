import { HttpException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { GlobalExceptionFilter } from './global-exception.filter'

function captureEnabledPublicError(errorCode?: string) {
  const json = vi.fn()
  const response = {
    json,
    setHeader: vi.fn(),
    status: vi.fn().mockReturnValue({ json }),
  }
  const request = { requestId: 'request-1', url: '/property-proposals' }
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }

  new GlobalExceptionFilter('test', undefined, { publicErrorEnvelopeEnabled: true }).catch(
    new HttpException({ errorCode }, 409),
    host as never,
  )

  return { json, response }
}

describe('GlobalExceptionFilter public error envelope', () => {
  it('passes a known property-proposal code through the enabled exact envelope', () => {
    const { json, response } = captureEnabledPublicError('PROPERTY_PROPOSAL_STATE_CONFLICT')

    expect(response.status).toHaveBeenCalledWith(409)
    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      errorCode: 'PROPERTY_PROPOSAL_STATE_CONFLICT',
      requestId: 'request-1',
    })
    expect(Object.keys(json.mock.calls[0]![0])).toEqual(['statusCode', 'errorCode', 'requestId'])
  })

  it.each(['UNTRUSTED_CODE', undefined])('falls back for an %s producer code', (errorCode) => {
    const { json } = captureEnabledPublicError(errorCode)

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      errorCode: 'REQUEST_FAILED',
      requestId: 'request-1',
    })
  })
})
