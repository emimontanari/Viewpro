import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import type { SanitizedSentryException, SentryService } from '../../observability/sentry.service'
import { isPublicErrorCode, type PublicErrorEnvelope } from '@viewpro/contracts'
import type { ApiErrorResponse } from '../errors/api-error-response'

type HttpExceptionBody = {
  error?: string
  message?: string | string[]
  statusCode?: number
  errorCode?: string
}

export type GlobalExceptionFilterOptions = {
  publicErrorEnvelopeEnabled?: boolean
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly nodeEnv = process.env.NODE_ENV ?? 'development',
    private readonly sentryService?: Pick<SentryService, 'captureException'>,
    private readonly options: GlobalExceptionFilterOptions = {},
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { requestId?: string }>()
    const requestId = request.requestId ?? randomUUID()

    if (!request.requestId) {
      request.requestId = requestId
      response.setHeader('x-request-id', requestId)
    }

    const statusCode =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined

    const body =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as HttpExceptionBody)
        : undefined

    const payload: ApiErrorResponse = this.options.publicErrorEnvelopeEnabled
      ? this.publicErrorPayload(statusCode, body?.errorCode, requestId)
      : {
          statusCode,
          error: body?.error ?? (statusCode === 500 ? 'Internal Server Error' : 'Error'),
          message: this.resolveMessage(statusCode, body?.message, exceptionResponse),
          ...(body?.errorCode ? { errorCode: body.errorCode } : {}),
          path: request.url,
          timestamp: new Date().toISOString(),
          requestId,
        }

    if (shouldCaptureException(exception, statusCode)) {
      try {
        this.sentryService?.captureException(sanitizeExceptionForSentry(exception, statusCode), {
          requestId,
          path: safeRoutePath(request),
          statusCode,
          environment: this.nodeEnv,
        })
      } catch {}
    }

    response.status(statusCode).json(payload)
  }

  private publicErrorPayload(statusCode: number, errorCode: unknown, requestId: string): PublicErrorEnvelope {
    return {
      statusCode,
      errorCode: isPublicErrorCode(errorCode) ? errorCode : 'REQUEST_FAILED',
      requestId,
    }
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

function safeRoutePath(request: Request) {
  return typeof request.route?.path === 'string' ? request.route.path : 'unmatched_route'
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
