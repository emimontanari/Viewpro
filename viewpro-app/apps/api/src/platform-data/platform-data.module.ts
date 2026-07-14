import { Module } from '@nestjs/common'
import { PlatformOutboxWriter } from './platform-outbox-writer.js'
import { PrismaOutboxRepository } from './platform-outbox.repository.js'
import { PlatformDataController } from './platform-data.controller.js'
import { PlatformControlGuard } from '../platform-control/platform-control.guard.js'

/**
 * PlatformDataModule — data-lane publisher (read side + outbox writer).
 *
 * Wires:
 *  - PlatformOutboxWriter: inserts outbox rows inside $transaction closures (D3, WU-1)
 *  - PrismaOutboxRepository: read-side query for the change-feed endpoint (D1, WU-2)
 *  - PlatformDataController: GET /internal/platform/changes (D1, D2, WU-2)
 *  - PlatformControlGuard: reused by import from platform-control (D2) — NOT merged
 *    into PlatformControlModule; guard is provided here so the controller can use it.
 *
 * Design D2: PlatformDataModule is a SIBLING to PlatformControlModule.
 * It reuses PlatformControlGuard by providing it directly — no JwtModule import.
 * The guard reads PLATFORM_CONTROL_SECRET from process.env via verifyServiceToken.
 */
@Module({
  controllers: [PlatformDataController],
  providers: [PlatformOutboxWriter, PrismaOutboxRepository, PlatformControlGuard],
  exports: [PlatformOutboxWriter],
})
export class PlatformDataModule {}
