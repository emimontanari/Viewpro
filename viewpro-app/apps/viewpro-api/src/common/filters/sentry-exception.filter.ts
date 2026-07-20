import { ArgumentsHost, Catch, HttpException, HttpServer, HttpStatus } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import type { Request } from 'express'
import type {
  SafeErrorContext,
  SanitizedSentryException,
  SentryService,
} from '../../observability/sentry.service'

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  constructor(
    httpAdapter: HttpServer,
    private readonly sentryService: Pick<SentryService, 'captureException'>,
    private readonly nodeEnv: string,
  ) {
    super(httpAdapter)
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request & { requestId?: string }>()

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    if (!(exception instanceof HttpException) || statusCode >= 500) {
      const sanitized: SanitizedSentryException = {
        type: exception instanceof HttpException ? 'HttpException' : 'UnhandledException',
        statusCode,
      }
      const context: SafeErrorContext = {
        requestId: request.requestId,
        path: request.url,
        statusCode,
        environment: this.nodeEnv,
      }
      this.sentryService.captureException(sanitized, context)
    }

    super.catch(exception, host)
  }
}
