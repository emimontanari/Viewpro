import { Module } from '@nestjs/common'
import { PrismaDocumentsRepository } from './prisma-documents.repository'
import { DOCUMENTS_REPOSITORY } from './documents.repository'
import { DOCUMENT_STORAGE_PORT } from './storage/document-storage.port'
import { FakeDocumentStorageAdapter } from './storage/fake-document-storage.adapter'

@Module({
  providers: [
    { provide: DOCUMENTS_REPOSITORY, useClass: PrismaDocumentsRepository },
    { provide: DOCUMENT_STORAGE_PORT, useClass: FakeDocumentStorageAdapter },
  ],
  exports: [DOCUMENTS_REPOSITORY, DOCUMENT_STORAGE_PORT],
})
export class DocumentsModule {}
