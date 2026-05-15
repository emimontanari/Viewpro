import { Module } from '@nestjs/common'
import { PrismaDocumentsRepository } from './prisma-documents.repository'
import { DOCUMENTS_REPOSITORY } from './documents.repository'
import { DOCUMENT_STORAGE_PORT } from './storage/document-storage.port'
import { FakeDocumentStorageAdapter } from './storage/fake-document-storage.adapter'
import { CreateDocumentRequestUseCase } from './use-cases/create-document-request.use-case'
import { GetDocumentRequestUseCase } from './use-cases/get-document-request.use-case'
import { ListDocumentRequestsUseCase } from './use-cases/list-document-requests.use-case'
import { ApproveDocumentRequestUseCase } from './use-cases/approve-document-request.use-case'
import { RejectDocumentRequestUseCase } from './use-cases/reject-document-request.use-case'

@Module({
  providers: [
    { provide: DOCUMENTS_REPOSITORY, useClass: PrismaDocumentsRepository },
    { provide: DOCUMENT_STORAGE_PORT, useClass: FakeDocumentStorageAdapter },
    CreateDocumentRequestUseCase,
    ListDocumentRequestsUseCase,
    GetDocumentRequestUseCase,
    ApproveDocumentRequestUseCase,
    RejectDocumentRequestUseCase,
  ],
  exports: [
    DOCUMENTS_REPOSITORY,
    DOCUMENT_STORAGE_PORT,
    CreateDocumentRequestUseCase,
    ListDocumentRequestsUseCase,
    GetDocumentRequestUseCase,
    ApproveDocumentRequestUseCase,
    RejectDocumentRequestUseCase,
  ],
})
export class DocumentsModule {}
