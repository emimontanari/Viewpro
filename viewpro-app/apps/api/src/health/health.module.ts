import { Module } from '@nestjs/common'
import { EmailModule } from '../email/email.module'
import { HealthController } from './health.controller'

@Module({
  imports: [EmailModule],
  controllers: [HealthController],
})
export class HealthModule {}
