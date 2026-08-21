import { HttpException } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SentryExceptionFilter } from '../sentry-exception.filter'

describe('SentryExceptionFilter', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    [new HttpException('client', 499), undefined],
    [new HttpException('server', 500), { type: 'HttpException', statusCode: 500 }],
    [new Error('internal'), { type: 'UnhandledException', statusCode: 500 }],
  ])('handles telemetry classification without changing delegation', (exception, expected) => {
    const captureException = vi.fn()
    const delegate = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined)
    new SentryExceptionFilter({} as never, { captureException } as never).catch(exception, {} as never)
    expected ? expect(captureException).toHaveBeenCalledWith(expected) : expect(captureException).not.toHaveBeenCalled()
    expect(delegate).toHaveBeenCalledWith(exception, expect.anything())
  })

  it('delegates when capture throws', () => {
    const delegate = vi.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined)
    const captureException = vi.fn(() => { throw new Error('telemetry failure') })
    expect(() => new SentryExceptionFilter({} as never, { captureException } as never).catch(new Error('internal'), {} as never)).not.toThrow()
    expect(delegate).toHaveBeenCalled()
  })
})
