import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { SentryService } from '../sentry.service'

function createService(dsn: string | undefined) {
  const sentryClient = { init: vi.fn(), captureException: vi.fn() }
  const service = new SentryService(new ConfigService({ app: { sentry: { dsn, environment: 'production', tracesSampleRate: 0 } } }), sentryClient)
  return { service, sentryClient }
}

describe('SentryService', () => {
  it('captures a platform failure with classified tags and no request metadata', () => {
    const { service, sentryClient } = createService('https://public.example/1')

    service.initialize()
    service.captureException({ type: 'PlatformSyncFailure', statusCode: 500, failureCode: 'FEED_TIMEOUT' })

    expect(sentryClient.captureException).toHaveBeenCalledWith(
      { type: 'PlatformSyncFailure', statusCode: 500, failureCode: 'FEED_TIMEOUT' },
      { tags: { environment: 'production', statusCode: '500', exceptionType: 'PlatformSyncFailure', failureCode: 'FEED_TIMEOUT' } },
    )
    sentryClient.captureException.mockImplementationOnce(() => { throw new Error('telemetry failure') })
    expect(() => service.captureException({ type: 'PlatformSyncFailure', statusCode: 500 })).not.toThrow()
  })

  it('does not initialize or emit telemetry without a configured DSN', () => {
    const { service, sentryClient } = createService(undefined)

    service.initialize()
    service.captureException({ type: 'UnhandledException', statusCode: 500 })

    expect(sentryClient.init).not.toHaveBeenCalled()
    expect(sentryClient.captureException).not.toHaveBeenCalled()
  })

  it('stays disabled when initialization fails', () => {
    const { service, sentryClient } = createService('https://public.example/1')
    sentryClient.init.mockImplementationOnce(() => { throw new Error('telemetry failure') })
    expect(() => service.initialize()).not.toThrow()
    expect(service.isEnabled()).toBe(false)
  })
})
