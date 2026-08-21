import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Sentry from '@sentry/node'

export type SanitizedSentryException = {
  type: 'HttpException' | 'UnhandledException' | 'PlatformSyncFailure'
  statusCode: number
  failureCode?: 'CURSOR_READ_FAILED' | 'FEED_TIMEOUT' | 'FEED_FAILED' | 'PROJECTION_FAILED' | 'CURSOR_ADVANCE_FAILED'
}

export type SentryCapture = Pick<SentryService, 'captureException'>

type SentryClient = {
  init: typeof Sentry.init
  captureException: typeof Sentry.captureException
}

export const SENTRY_CLIENT = Symbol('SENTRY_CLIENT')
export const SENTRY_CAPTURE = Symbol('SENTRY_CAPTURE')

@Injectable()
export class SentryService implements OnModuleInit {
  private enabled = false

  constructor(
    private readonly configService: ConfigService,
    @Inject(SENTRY_CLIENT)
    private readonly sentryClient: SentryClient = Sentry,
  ) {}

  onModuleInit() {
    this.initialize()
  }

  initialize() {
    const dsn = this.configService.get<string | undefined>('app.sentry.dsn')

    if (!dsn || this.enabled) {
      return
    }

    try {
      this.sentryClient.init({ dsn, environment: this.getEnvironment(), tracesSampleRate: this.configService.get<number>('app.sentry.tracesSampleRate') ?? 0, sendDefaultPii: false })
      this.enabled = true
    } catch {}
  }

  captureException(error: SanitizedSentryException) {
    if (!this.enabled) {
      return
    }

    try { this.sentryClient.captureException(error, { tags: { environment: this.getEnvironment(), statusCode: String(error.statusCode), exceptionType: error.type, ...(error.failureCode ? { failureCode: error.failureCode } : {}) } }) } catch {}
  }

  isEnabled() {
    return this.enabled
  }

  private getEnvironment() {
    return this.configService.get<string>('app.sentry.environment') ?? 'development'
  }
}
