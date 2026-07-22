import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Sentry from '@sentry/node'

export type SafeErrorContext = {
  requestId?: string
  path: string
  statusCode: number
  environment: string
}

export type SanitizedSentryException = {
  type: 'HttpException' | 'UnhandledException'
  statusCode: number
}

type SentryClient = {
  init: typeof Sentry.init
  captureException: typeof Sentry.captureException
}

export const SENTRY_CLIENT = Symbol('SENTRY_CLIENT')

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

    this.sentryClient.init({
      dsn,
      environment: this.getEnvironment(),
      tracesSampleRate: this.configService.get<number>('app.sentry.tracesSampleRate') ?? 0,
      sendDefaultPii: false,
    })
    this.enabled = true
  }

  captureException(error: SanitizedSentryException, context: SafeErrorContext) {
    if (!this.enabled) {
      return
    }

    this.sentryClient.captureException(error, {
      tags: {
        environment: context.environment,
        statusCode: String(context.statusCode),
      },
      extra: {
        requestId: context.requestId,
        path: context.path,
      },
    })
  }

  isEnabled() {
    return this.enabled
  }

  private getEnvironment() {
    return this.configService.get<string>('app.sentry.environment') ?? 'development'
  }
}
