import { Module } from '@nestjs/common'
import { PlatformOutboxWriter } from './platform-outbox-writer.js'

/**
 * PlatformDataModule — data-lane outbox producer (WU-1).
 *
 * Provides PlatformOutboxWriter for injection into domain repositories
 * that write outbox rows inside their $transaction closures (D3).
 *
 * WU-2 will extend this module with the change-feed endpoint and reader.
 */
@Module({
  providers: [PlatformOutboxWriter],
  exports: [PlatformOutboxWriter],
})
export class PlatformDataModule {}
