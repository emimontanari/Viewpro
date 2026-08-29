import { ArgumentsHost, Catch, HttpException, HttpServer, HttpStatus } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import type {
  SanitizedSentryException,
  SentryService,
} from '../../observability/sentry.service'

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(
    httpAdapter: HttpServer,
    private readonly sentryService: Pick<SentryService, 'captureException'>,
  ) {
    super(httpAdapter)
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    if (!(exception instanceof HttpException) || statusCode >= 500) {
      const sanitized: SanitizedSentryException = {
        type: exception instanceof HttpException ? 'HttpException' : 'UnhandledException',
        statusCode,
      }
      try { this.sentryService.captureException(sanitized) } catch {}
    }

    super.catch(exception, host)
  }
}
