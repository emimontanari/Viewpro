import { Module } from '@nestjs/common'
import * as Sentry from '@sentry/node'
import { SENTRY_CAPTURE, SENTRY_CLIENT, SentryService } from './sentry.service'

@Module({
  providers: [
    {
      provide: SENTRY_CLIENT,
      useValue: Sentry,
    },
    SentryService,
    { provide: SENTRY_CAPTURE, useExisting: SentryService },
  ],
  exports: [SentryService, SENTRY_CAPTURE],
})
export class ObservabilityModule {}
