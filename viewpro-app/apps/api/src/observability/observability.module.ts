import { Module } from '@nestjs/common'
import * as Sentry from '@sentry/node'
import { SENTRY_CLIENT, SentryService } from './sentry.service'

@Module({
  providers: [
    {
      provide: SENTRY_CLIENT,
      useValue: Sentry,
    },
    SentryService,
  ],
  exports: [SentryService],
})
export class ObservabilityModule {}
