import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Request, Response } from 'express'
import type { ApiErrorResponse } from '../errors/api-error-response'

type HttpExceptionBody = {
  error?: string
  message?: string | string[]
  statusCode?: number
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
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
      message:
        body?.message ?? (typeof exceptionResponse === 'string' ? exceptionResponse : 'Unexpected error'),
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.requestId,
    }

    response.status(statusCode).json(payload)
  }
}
