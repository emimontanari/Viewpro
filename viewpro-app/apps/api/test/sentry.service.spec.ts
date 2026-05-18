import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { SentryService } from '../src/observability/sentry.service'

describe('SentryService', () => {
  it('stays disabled and does not capture when the DSN is missing', () => {
    const sentryClient = {
      init: vi.fn(),
      captureException: vi.fn(),
    }
    const service = new SentryService(
      new ConfigService({
        app: {
          sentry: {
            dsn: undefined,
            environment: 'test',
            tracesSampleRate: 0,
          },
        },
      }),
      sentryClient,
    )

    service.initialize()
    service.captureException({ type: 'UnhandledException', statusCode: 500 }, {
      requestId: 'request-1',
      path: '/api/health',
      statusCode: 500,
      environment: 'test',
    })

    expect(service.isEnabled()).toBe(false)
    expect(sentryClient.init).not.toHaveBeenCalled()
    expect(sentryClient.captureException).not.toHaveBeenCalled()
  })

  it('initializes and captures errors with safe context only when enabled', () => {
    const sentryClient = {
      init: vi.fn(),
      captureException: vi.fn(),
    }
    const service = new SentryService(
      new ConfigService({
        app: {
          sentry: {
            dsn: 'https://public.example/1',
            environment: 'production',
            tracesSampleRate: 0,
          },
        },
      }),
      sentryClient,
    )
    const sanitizedException = { type: 'UnhandledException' as const, statusCode: 500 }

    service.initialize()
    service.captureException(sanitizedException, {
      requestId: 'request-2',
      path: '/api/admin/summary',
      statusCode: 500,
      environment: 'production',
    })

    expect(service.isEnabled()).toBe(true)
    expect(sentryClient.init).toHaveBeenCalledWith({
      dsn: 'https://public.example/1',
      environment: 'production',
      tracesSampleRate: 0,
      sendDefaultPii: false,
    })
    expect(sentryClient.captureException).toHaveBeenCalledWith(sanitizedException, {
      tags: {
        environment: 'production',
        statusCode: '500',
      },
      extra: {
        requestId: 'request-2',
        path: '/api/admin/summary',
      },
    })
  })
})
