import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AnalyticsActorType, AnalyticsEventName, DocumentRequestStatus, DocumentVersionStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmOwnerDocumentUploadUseCase } from '../src/documents/use-cases/confirm-owner-document-upload.use-case'
import { CreateOwnerDocumentReadUrlUseCase } from '../src/documents/use-cases/create-owner-document-read-url.use-case'
import { CreateOwnerDocumentUploadUrlUseCase } from '../src/documents/use-cases/create-owner-document-upload-url.use-case'
import { GetOwnerDocumentRequestUseCase } from '../src/documents/use-cases/get-owner-document-request.use-case'
import { ListOwnerDocumentRequestsUseCase } from '../src/documents/use-cases/list-owner-document-requests.use-case'

const ownerUser = { id: 'owner-1', email: 'owner@example.com' }

const documentRequest = {
  id: 'request-1',
  tenantId: 'tenant-1',
  propertyEngagementId: 'engagement-1',
  ownerUserId: 'owner-1',
  requestedByUserId: 'agent-1',
  title: 'Property deed',
  description: 'Latest signed deed.',
  status: DocumentRequestStatus.PENDING,
  reviewedByUserId: null,
  reviewedAt: null,
  rejectionReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  document: null,
  propertyEngagement: { id: 'engagement-1', tenantId: 'tenant-1', propertyAssetId: 'asset-1' },
}

const uploadedVersion = {
  id: 'version-1',
  documentId: 'document-1',
  document: { documentRequestId: 'request-1' },
  uploadedByUserId: 'owner-1',
  storageKey: 'document-requests/request-1/deed.pdf',
  originalFilename: 'deed.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  checksum: 'sha256:abc123',
  status: DocumentVersionStatus.UPLOADED,
  createdAt: new Date('2026-01-03T00:00:00.000Z'),
  updatedAt: new Date('2026-01-04T00:00:00.000Z'),
}

describe('Owner document use cases', () => {
  describe('ListOwnerDocumentRequestsUseCase', () => {
    it('lists only document requests addressed to the owner', async () => {
      const repository = { listOwnerRequests: vi.fn().mockResolvedValue({ items: [documentRequest], total: 1 }) }
      const useCase = new ListOwnerDocumentRequestsUseCase(repository as never)

      const result = await useCase.execute(ownerUser, { page: 2, pageSize: 5, status: DocumentRequestStatus.PENDING })

      expect(result).toMatchObject({ total: 1, page: 2, pageSize: 5 })
      expect(result.items.map((item) => item.ownerUserId)).toEqual(['owner-1'])
      expect(repository.listOwnerRequests).toHaveBeenCalledWith({
        ownerUserId: 'owner-1',
        page: 2,
        pageSize: 5,
        status: DocumentRequestStatus.PENDING,
      })
    })
  })

  describe('GetOwnerDocumentRequestUseCase', () => {
    it('returns owner request detail when owner and active property access match', async () => {
      const repository = { findOwnerRequestDetail: vi.fn().mockResolvedValue(documentRequest) }
      const useCase = new GetOwnerDocumentRequestUseCase(repository as never)

      await expect(useCase.execute(ownerUser, 'request-1')).resolves.toMatchObject({ id: 'request-1', ownerUserId: 'owner-1' })
      expect(repository.findOwnerRequestDetail).toHaveBeenCalledWith({ ownerUserId: 'owner-1', requestId: 'request-1' })
    })

    it('returns not found for another owner or revoked property access', async () => {
      const repository = { findOwnerRequestDetail: vi.fn().mockResolvedValue(null) }
      const useCase = new GetOwnerDocumentRequestUseCase(repository as never)

      await expect(useCase.execute({ id: 'owner-2', email: 'other@example.com' }, 'request-1')).rejects.toThrow(
        new NotFoundException('Document request not found'),
      )
    })
  })

  describe('CreateOwnerDocumentUploadUrlUseCase', () => {
    it('creates a pending upload version and signed upload URL for a pending request', async () => {
      const pendingVersion = { ...uploadedVersion, status: DocumentVersionStatus.PENDING_UPLOAD }
      const repository = {
        findOwnerRequestDetail: vi.fn().mockResolvedValue(documentRequest),
        createPendingVersion: vi.fn().mockResolvedValue(pendingVersion),
      }
      const storage = {
        createUploadUrl: vi.fn().mockResolvedValue({
          url: 'https://storage.example/upload/document-requests/request-1/deed.pdf',
          storageKey: 'document-requests/request-1/deed.pdf',
          expiresInSeconds: 600,
        }),
      }
      const useCase = new CreateOwnerDocumentUploadUrlUseCase(repository as never, storage as never)

      const result = await useCase.execute(ownerUser, 'request-1', {
        originalFilename: 'Deed.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksum: 'sha256:abc123',
      })

      expect(result).toMatchObject({
        request: { id: 'request-1' },
        version: { id: 'version-1', status: DocumentVersionStatus.PENDING_UPLOAD },
        uploadUrl: { expiresInSeconds: 600, storageKey: 'document-requests/request-1/deed.pdf' },
      })
      expect(repository.createPendingVersion).toHaveBeenCalledWith({
        documentRequestId: 'request-1',
        uploadedByUserId: 'owner-1',
        storageKey: 'document-requests/request-1/deed.pdf',
        originalFilename: 'Deed.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksum: 'sha256:abc123',
      })
      expect(storage.createUploadUrl).toHaveBeenCalledWith({ storageKey: 'document-requests/request-1/deed.pdf', expiresInSeconds: 600 })
    })

    it('allows a rejected request to receive a new upload URL', async () => {
      const rejectedRequest = { ...documentRequest, status: DocumentRequestStatus.REJECTED }
      const repository = {
        findOwnerRequestDetail: vi.fn().mockResolvedValue(rejectedRequest),
        createPendingVersion: vi.fn().mockResolvedValue({ ...uploadedVersion, status: DocumentVersionStatus.PENDING_UPLOAD }),
      }
      const storage = { createUploadUrl: vi.fn().mockResolvedValue({ url: 'https://storage.example/upload', storageKey: uploadedVersion.storageKey, expiresInSeconds: 600 }) }
      const useCase = new CreateOwnerDocumentUploadUrlUseCase(repository as never, storage as never)

      await expect(
        useCase.execute(ownerUser, 'request-1', { originalFilename: 'photo.png', mimeType: 'image/png', sizeBytes: 2048 }),
      ).resolves.toMatchObject({ request: { status: DocumentRequestStatus.REJECTED } })
    })

    it('rejects invalid MIME types and files over 10 MB', async () => {
      const repository = { findOwnerRequestDetail: vi.fn(), createPendingVersion: vi.fn() }
      const storage = { createUploadUrl: vi.fn() }
      const useCase = new CreateOwnerDocumentUploadUrlUseCase(repository as never, storage as never)

      await expect(
        useCase.execute(ownerUser, 'request-1', { originalFilename: 'deed.txt', mimeType: 'text/plain', sizeBytes: 1024 }),
      ).rejects.toThrow(new BadRequestException('Unsupported document MIME type'))
      await expect(
        useCase.execute(ownerUser, 'request-1', { originalFilename: 'deed.pdf', mimeType: 'application/pdf', sizeBytes: 10 * 1024 * 1024 + 1 }),
      ).rejects.toThrow(new BadRequestException('Document file exceeds 10 MB'))
      expect(repository.findOwnerRequestDetail).not.toHaveBeenCalled()
      expect(storage.createUploadUrl).not.toHaveBeenCalled()
    })

    it('returns not found for another owner', async () => {
      const repository = { findOwnerRequestDetail: vi.fn().mockResolvedValue(null), createPendingVersion: vi.fn() }
      const storage = { createUploadUrl: vi.fn() }
      const useCase = new CreateOwnerDocumentUploadUrlUseCase(repository as never, storage as never)

      await expect(
        useCase.execute({ id: 'owner-2', email: 'other@example.com' }, 'request-1', {
          originalFilename: 'deed.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        }),
      ).rejects.toThrow(new NotFoundException('Document request not found'))
      expect(repository.createPendingVersion).not.toHaveBeenCalled()
    })
  })

  describe('ConfirmOwnerDocumentUploadUseCase', () => {
    it('confirms the owner pending upload and submits the request', async () => {
      const pendingVersion = { ...uploadedVersion, status: DocumentVersionStatus.PENDING_UPLOAD }
      const repository = {
        findOwnerPendingUploadVersion: vi.fn().mockResolvedValue(pendingVersion),
        markVersionUploaded: vi.fn().mockResolvedValue(uploadedVersion),
      }
      const analyticsService = { track: vi.fn().mockResolvedValue({ status: 'persisted' }) }
      const useCase = new ConfirmOwnerDocumentUploadUseCase(repository as never, analyticsService as never)

      const result = await useCase.execute(ownerUser, 'version-1')

      expect(result).toMatchObject({ id: 'version-1', status: DocumentVersionStatus.UPLOADED })
      expect(repository.findOwnerPendingUploadVersion).toHaveBeenCalledWith({ ownerUserId: 'owner-1', versionId: 'version-1' })
      expect(repository.markVersionUploaded).toHaveBeenCalledWith({ versionId: 'version-1' })
      expect(analyticsService.track).toHaveBeenCalledWith({
        eventName: AnalyticsEventName.DOCUMENT_UPLOADED,
        actorType: AnalyticsActorType.OWNER,
        actorUserId: 'owner-1',
        documentRequestId: 'request-1',
      })
    })

    it('keeps upload confirmation successful when analytics tracking fails', async () => {
      const pendingVersion = { ...uploadedVersion, status: DocumentVersionStatus.PENDING_UPLOAD }
      const repository = {
        findOwnerPendingUploadVersion: vi.fn().mockResolvedValue(pendingVersion),
        markVersionUploaded: vi.fn().mockResolvedValue(uploadedVersion),
      }
      const analyticsService = { track: vi.fn().mockRejectedValue(new Error('analytics unavailable')) }
      const useCase = new ConfirmOwnerDocumentUploadUseCase(repository as never, analyticsService as never)

      await expect(useCase.execute(ownerUser, 'version-1')).resolves.toMatchObject({ id: 'version-1' })
    })

    it('returns not found for inaccessible or non-pending versions', async () => {
      const repository = { findOwnerPendingUploadVersion: vi.fn().mockResolvedValue(null), markVersionUploaded: vi.fn() }
      const useCase = new ConfirmOwnerDocumentUploadUseCase(repository as never, { track: vi.fn() } as never)

      await expect(useCase.execute({ id: 'owner-2', email: 'other@example.com' }, 'version-1')).rejects.toThrow(
        new NotFoundException('Document version not found'),
      )
      expect(repository.markVersionUploaded).not.toHaveBeenCalled()
    })
  })

  describe('CreateOwnerDocumentReadUrlUseCase', () => {
    it('creates a read URL for an uploaded owner version', async () => {
      const repository = { findOwnerReadableVersion: vi.fn().mockResolvedValue(uploadedVersion) }
      const storage = { createReadUrl: vi.fn().mockResolvedValue({ url: 'https://storage.example/read', storageKey: uploadedVersion.storageKey, expiresInSeconds: 300 }) }
      const useCase = new CreateOwnerDocumentReadUrlUseCase(repository as never, storage as never)

      const result = await useCase.execute(ownerUser, 'version-1')

      expect(result).toMatchObject({ version: { id: 'version-1' }, readUrl: { expiresInSeconds: 300 } })
      expect(repository.findOwnerReadableVersion).toHaveBeenCalledWith({ ownerUserId: 'owner-1', versionId: 'version-1' })
      expect(storage.createReadUrl).toHaveBeenCalledWith({ storageKey: uploadedVersion.storageKey, expiresInSeconds: 300 })
    })

    it('returns not found for another owner version', async () => {
      const repository = { findOwnerReadableVersion: vi.fn().mockResolvedValue(null) }
      const storage = { createReadUrl: vi.fn() }
      const useCase = new CreateOwnerDocumentReadUrlUseCase(repository as never, storage as never)

      await expect(useCase.execute({ id: 'owner-2', email: 'other@example.com' }, 'version-1')).rejects.toThrow(
        new NotFoundException('Document version not found'),
      )
      expect(storage.createReadUrl).not.toHaveBeenCalled()
    })
  })
})
