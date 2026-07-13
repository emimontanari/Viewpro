import type { ConfigService } from '@nestjs/config'
import type { EmailSender } from './email-sender.port'
import { NoopEmailSender } from './noop-email-sender'
import { createResendClient, ResendEmailSender } from './resend-email-sender'

/**
 * Chooses the EmailSender implementation based on configuration:
 * ResendEmailSender when app.email.apiKey is set, otherwise NoopEmailSender.
 */
export function createEmailSender(configService: ConfigService): EmailSender {
  const apiKey = configService.get<string | undefined>('app.email.apiKey')

  if (!apiKey) {
    return new NoopEmailSender()
  }

  const fromAddress =
    configService.get<string | undefined>('app.email.fromAddress') ?? 'no-reply@inmoview.app'

  return new ResendEmailSender(fromAddress, createResendClient(apiKey))
}
