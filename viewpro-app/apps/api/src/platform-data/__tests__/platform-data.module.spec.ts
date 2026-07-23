import { Test } from '@nestjs/testing'
import { ClsModule } from 'nestjs-cls'
import { describe, expect, it } from 'vitest'
import { ConfigModule } from '../../config/config.module'
import { DatabaseModule } from '../../database/database.module'
import { CreatePlatformDocumentReadUrlUseCase } from '../../documents/use-cases/create-platform-document-read-url.use-case'
import { PlatformDataController } from '../platform-data.controller'
import { PlatformDataModule } from '../platform-data.module'

/**
 * 2a.6 — DI wiring regression guard (operator-activity-media, lesson from
 * Slice 1's PROPERTY_ASSET_IMAGES_READ_REPOSITORY bug, see apply-progress
 * #6204): PlatformDataModule must resolve its FULL provider graph — including
 * every NEW token this slice adds (DOCUMENT_STORAGE_PORT +
 * CreatePlatformDocumentReadUrlUseCase) — WITHOUT a live database connection.
 * `.compile()` never issues a query, so this test catches a missing provider
 * binding at the exact class of bug that only otherwise surfaces as an e2e
 * "Nest cannot create <Module> instance" bootstrap timeout under CI Postgres.
 */
describe('PlatformDataModule — DI graph resolves (no live DB required)', () => {
  it('compiles standalone and resolves PlatformDataController + CreatePlatformDocumentReadUrlUseCase', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ClsModule.forRoot({ global: true }), ConfigModule, DatabaseModule, PlatformDataModule],
    }).compile()

    expect(moduleRef.get(PlatformDataController)).toBeInstanceOf(PlatformDataController)
    expect(moduleRef.get(CreatePlatformDocumentReadUrlUseCase)).toBeInstanceOf(CreatePlatformDocumentReadUrlUseCase)
  })
})
