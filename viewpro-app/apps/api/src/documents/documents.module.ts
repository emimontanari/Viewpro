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
import { ConfirmOwnerDocumentUploadUseCase } from './use-cases/confirm-owner-document-upload.use-case'
import { CreateInternalDocumentReadUrlUseCase } from './use-cases/create-internal-document-read-url.use-case'
import { CreateOwnerDocumentReadUrlUseCase } from './use-cases/create-owner-document-read-url.use-case'
import { CreateOwnerDocumentUploadUrlUseCase } from './use-cases/create-owner-document-upload-url.use-case'
import { GetOwnerDocumentRequestUseCase } from './use-cases/get-owner-document-request.use-case'
import { ListOwnerDocumentRequestsUseCase } from './use-cases/list-owner-document-requests.use-case'

@Module({
  providers: [
    { provide: DOCUMENTS_REPOSITORY, useClass: PrismaDocumentsRepository },
    { provide: DOCUMENT_STORAGE_PORT, useClass: FakeDocumentStorageAdapter },
    CreateDocumentRequestUseCase,
    ListDocumentRequestsUseCase,
    GetDocumentRequestUseCase,
    ApproveDocumentRequestUseCase,
    RejectDocumentRequestUseCase,
    ListOwnerDocumentRequestsUseCase,
    GetOwnerDocumentRequestUseCase,
    CreateOwnerDocumentUploadUrlUseCase,
    ConfirmOwnerDocumentUploadUseCase,
    CreateOwnerDocumentReadUrlUseCase,
    CreateInternalDocumentReadUrlUseCase,
  ],
  exports: [
    DOCUMENTS_REPOSITORY,
    DOCUMENT_STORAGE_PORT,
    CreateDocumentRequestUseCase,
    ListDocumentRequestsUseCase,
    GetDocumentRequestUseCase,
    ApproveDocumentRequestUseCase,
    RejectDocumentRequestUseCase,
    ListOwnerDocumentRequestsUseCase,
    GetOwnerDocumentRequestUseCase,
    CreateOwnerDocumentUploadUrlUseCase,
    ConfirmOwnerDocumentUploadUseCase,
    CreateOwnerDocumentReadUrlUseCase,
    CreateInternalDocumentReadUrlUseCase,
  ],
})
export class DocumentsModule {}
