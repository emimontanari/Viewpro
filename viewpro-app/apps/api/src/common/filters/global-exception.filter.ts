import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { SanitizedSentryException, SentryService } from '../../observability/sentry.service'
import type { ApiErrorResponse } from '../errors/api-error-response'

type HttpExceptionBody = {
  error?: string
  message?: string | string[]
  statusCode?: number
  errorCode?: string
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly nodeEnv = process.env.NODE_ENV ?? 'development',
    private readonly sentryService?: Pick<SentryService, 'captureException'>,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { requestId?: string }>()

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined

    const body =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as HttpExceptionBody)
        : undefined

    const payload: ApiErrorResponse = {
      statusCode,
      error: body?.error ?? (statusCode === 500 ? 'Internal Server Error' : 'Error'),
      message: this.resolveMessage(statusCode, body?.message, exceptionResponse),
      ...(body?.errorCode ? { errorCode: body.errorCode } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    }

    if (shouldCaptureException(exception, statusCode)) {
      this.sentryService?.captureException(sanitizeExceptionForSentry(exception, statusCode), {
        requestId: request.requestId,
        path: request.url,
        statusCode,
        environment: this.nodeEnv,
      })
    }

    response.status(statusCode).json(payload)
  }

  private resolveMessage(
    statusCode: number,
    message: string | string[] | undefined,
    exceptionResponse: string | object | undefined,
  ) {
    if (this.nodeEnv === 'production') {
      return sanitizeProductionMessage(statusCode)
    }

    return message ?? (typeof exceptionResponse === 'string' ? exceptionResponse : 'Unexpected error')
  }
}

function shouldCaptureException(exception: unknown, statusCode: number) {
  return !(exception instanceof HttpException) || statusCode >= 500
}

function sanitizeExceptionForSentry(exception: unknown, statusCode: number): SanitizedSentryException {
  return {
    type: exception instanceof HttpException ? 'HttpException' : 'UnhandledException',
    statusCode,
  }
}

function sanitizeProductionMessage(statusCode: number) {
  if (statusCode === HttpStatus.NOT_FOUND) {
    return 'Resource not found'
  }

  if (statusCode === HttpStatus.BAD_REQUEST) {
    return 'Invalid request payload'
  }

  if (statusCode >= 500) {
    return 'Unexpected error'
  }

  return 'Request failed'
}
