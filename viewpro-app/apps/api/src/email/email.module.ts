import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createEmailSender } from './email.factory'
import { EmailHealthRecorder } from './email-health.recorder'
import { EMAIL_SENDER } from './email-sender.port'
import { RecordingEmailSender } from './recording-email-sender'

@Module({
  providers: [
    EmailHealthRecorder,
    {
      provide: EMAIL_SENDER,
      // The recorder wraps whichever sender configuration chose, including the
      // no-op one — "nothing is being sent" is a state worth being able to see.
      useFactory: (configService: ConfigService, recorder: EmailHealthRecorder) =>
        new RecordingEmailSender(createEmailSender(configService), recorder),
      inject: [ConfigService, EmailHealthRecorder],
    },
  ],
  exports: [EMAIL_SENDER, EmailHealthRecorder],
})
export class EmailModule {}
