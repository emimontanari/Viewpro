import { ConfigService } from '@nestjs/config'
import { describe, expect, it, vi } from 'vitest'
import { createEmailSender } from './email.factory'
import { NoopEmailSender } from './noop-email-sender'
import { ResendEmailSender } from './resend-email-sender'

function buildConfig(email: { apiKey?: string; fromAddress?: string }) {
  return {
    get: vi.fn((key: string) => {
      if (key === 'app.email.apiKey') return email.apiKey
      if (key === 'app.email.fromAddress') return email.fromAddress
      return undefined
    }),
  } as unknown as ConfigService
}

describe('createEmailSender factory', () => {
  it('returns a Noop sender when the api key is absent', () => {
    const sender = createEmailSender(buildConfig({ fromAddress: 'no-reply@inmoview.app' }))
    expect(sender).toBeInstanceOf(NoopEmailSender)
  })

  it('returns a Resend sender when the api key is present', () => {
    const sender = createEmailSender(buildConfig({ apiKey: 're_test', fromAddress: 'no-reply@inmoview.app' }))
    expect(sender).toBeInstanceOf(ResendEmailSender)
  })
})
