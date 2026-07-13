import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createEmailSender } from './email.factory'
import { EMAIL_SENDER } from './email-sender.port'

@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      useFactory: (configService: ConfigService) => createEmailSender(configService),
      inject: [ConfigService],
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
