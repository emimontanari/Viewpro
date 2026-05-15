import { BadRequestException, NotFoundException } from '@nestjs/common'
import { DocumentRequestStatus, DocumentVersionStatus, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { PERMISSIONS } from '../src/permissions/permissions.constants'
import type { TenantContext } from '../src/tenant-context/tenant-context.types'
import { CreateDocumentRequestUseCase } from '../src/documents/use-cases/create-document-request.use-case'
import { GetDocumentRequestUseCase } from '../src/documents/use-cases/get-document-request.use-case'
import { ListDocumentRequestsUseCase } from '../src/documents/use-cases/list-document-requests.use-case'
import { ApproveDocumentRequestUseCase } from '../src/documents/use-cases/approve-document-request.use-case'
import { CreateInternalDocumentReadUrlUseCase } from '../src/documents/use-cases/create-internal-document-read-url.use-case'
import { RejectDocumentRequestUseCase } from '../src/documents/use-cases/reject-document-request.use-case'

const managerTenant: TenantContext = {
  tenantId: 'tenant-1',
  tenantSlug: 'tenant-one',
  tenantStatus: TenantStatus.ACTIVE,
  membershipId: 'membership-1',
  role: TenantRole.PRINCIPAL_MANAGER,
  permissions: [PERMISSIONS.DOCUMENTS_REQUEST, PERMISSIONS.DOCUMENTS_VIEW_ALL],
  userStatus: UserStatus.ACTIVE,
}

const sellerTenant: TenantContext = {
  ...managerTenant,
  role: TenantRole.AGENT,
  permissions: [PERMISSIONS.DOCUMENTS_REQUEST, PERMISSIONS.DOCUMENTS_REVIEW_OWN],
}

const currentUser = { id: 'agent-1', email: 'agent@example.com' }

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

const currentVersion = {
  id: 'version-1',
  documentId: 'document-1',
  uploadedByUserId: 'owner-1',
  storageKey: 'documents/request-1/version-1.pdf',
  originalFilename: 'deed.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  checksum: 'sha256:abc123',
  status: DocumentVersionStatus.UPLOADED,
  createdAt: new Date('2026-01-03T00:00:00.000Z'),
  updatedAt: new Date('2026-01-04T00:00:00.000Z'),
}

const submittedRequest = {
  ...documentRequest,
  status: DocumentRequestStatus.SUBMITTED,
  document: { currentVersion, versions: [currentVersion] },
}

describe('Document internal use cases', () => {
  describe('CreateDocumentRequestUseCase', () => {
    it('allows a manager to create a request for an owner with active property access', async () => {
      const repository = {
        findTenantEngagementForDocumentRequest: vi.fn().mockResolvedValue(documentRequest.propertyEngagement),
        createRequest: vi.fn().mockResolvedValue(documentRequest),
      }
      const useCase = new CreateDocumentRequestUseCase(repository as never)

      const result = await useCase.execute(managerTenant, currentUser, 'engagement-1', {
        ownerUserId: 'owner-1',
        title: 'Property deed',
        description: 'Latest signed deed.',
      })

      expect(result).toMatchObject({
        id: 'request-1',
        requestedByUserId: 'agent-1',
        ownerUserId: 'owner-1',
        status: DocumentRequestStatus.PENDING,
      })
      expect(repository.findTenantEngagementForDocumentRequest).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        propertyEngagementId: 'engagement-1',
        ownerUserId: 'owner-1',
      })
      expect(repository.createRequest).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        propertyEngagementId: 'engagement-1',
        ownerUserId: 'owner-1',
        requestedByUserId: 'agent-1',
        title: 'Property deed',
        description: 'Latest signed deed.',
      })
    })

    it('allows a seller to create a request without requiring property-agent assignment', async () => {
      const repository = {
        findTenantEngagementForDocumentRequest: vi.fn().mockResolvedValue(documentRequest.propertyEngagement),
        createRequest: vi.fn().mockResolvedValue({ ...documentRequest, requestedByUserId: 'seller-1' }),
      }
      const useCase = new CreateDocumentRequestUseCase(repository as never)

      await expect(
        useCase.execute(sellerTenant, { id: 'seller-1', email: 'seller@example.com' }, 'engagement-1', {
          ownerUserId: 'owner-1',
          title: 'Proof of identity',
        }),
      ).resolves.toMatchObject({ requestedByUserId: 'seller-1' })

      expect(repository.findTenantEngagementForDocumentRequest).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        propertyEngagementId: 'engagement-1',
        ownerUserId: 'owner-1',
      })
    })

    it('returns not found for cross-tenant engagements or owners without active access', async () => {
      const repository = {
        findTenantEngagementForDocumentRequest: vi.fn().mockResolvedValue(null),
        createRequest: vi.fn(),
      }
      const useCase = new CreateDocumentRequestUseCase(repository as never)

      await expect(
        useCase.execute(sellerTenant, currentUser, 'inaccessible-engagement', {
          ownerUserId: 'owner-1',
          title: 'Property deed',
        }),
      ).rejects.toThrow(new NotFoundException('Property engagement not found'))
      expect(repository.createRequest).not.toHaveBeenCalled()
    })
  })

  describe('ListDocumentRequestsUseCase', () => {
    it('allows a manager to list all tenant requests', async () => {
      const peerRequest = { ...documentRequest, id: 'request-2', requestedByUserId: 'seller-2' }
      const repository = { listInternalRequests: vi.fn().mockResolvedValue({ items: [documentRequest, peerRequest], total: 2 }) }
      const useCase = new ListDocumentRequestsUseCase(repository as never)

      const result = await useCase.execute(managerTenant, currentUser, { page: 2, pageSize: 10 })

      expect(result).toMatchObject({ total: 2, page: 2, pageSize: 10 })
      expect(result.items.map((item) => item.id)).toEqual(['request-1', 'request-2'])
      expect(repository.listInternalRequests).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        viewerUserId: 'agent-1',
        canViewAll: true,
        page: 2,
        pageSize: 10,
        status: undefined,
      })
    })

    it('allows a requesting seller to list only requests they created', async () => {
      const repository = { listInternalRequests: vi.fn().mockResolvedValue({ items: [documentRequest], total: 1 }) }
      const useCase = new ListDocumentRequestsUseCase(repository as never)

      const result = await useCase.execute(sellerTenant, currentUser, {})

      expect(result.items).toHaveLength(1)
      expect(result.items[0].requestedByUserId).toBe('agent-1')
      expect(repository.listInternalRequests).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        viewerUserId: 'agent-1',
        canViewAll: false,
        page: 1,
        pageSize: 20,
        status: undefined,
      })
    })
  })

  describe('GetDocumentRequestUseCase', () => {
    it('allows a manager to read peer-created request detail', async () => {
      const repository = { findInternalRequestDetail: vi.fn().mockResolvedValue(documentRequest) }
      const useCase = new GetDocumentRequestUseCase(repository as never)

      await expect(useCase.execute(managerTenant, currentUser, 'request-1')).resolves.toMatchObject({ id: 'request-1' })
      expect(repository.findInternalRequestDetail).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        viewerUserId: 'agent-1',
        canViewAll: true,
      })
    })

    it('returns not found when a peer seller reads another seller request', async () => {
      const repository = { findInternalRequestDetail: vi.fn().mockResolvedValue(null) }
      const useCase = new GetDocumentRequestUseCase(repository as never)

      await expect(useCase.execute(sellerTenant, { id: 'seller-2', email: 'seller2@example.com' }, 'request-1')).rejects.toThrow(
        new NotFoundException('Document request not found'),
      )
    })
  })

  describe('ApproveDocumentRequestUseCase', () => {
    it('allows a manager to approve a submitted request and preserve review audit fields', async () => {
      const approvedRequest = {
        ...submittedRequest,
        status: DocumentRequestStatus.APPROVED,
        reviewedByUserId: 'agent-1',
        reviewedAt: new Date('2026-01-05T00:00:00.000Z'),
        document: { currentVersion: { ...currentVersion, status: DocumentVersionStatus.APPROVED }, versions: [] },
      }
      const repository = {
        findInternalRequestDetail: vi.fn().mockResolvedValue(submittedRequest),
        reviewRequest: vi.fn().mockResolvedValue(approvedRequest),
      }
      const useCase = new ApproveDocumentRequestUseCase(repository as never)

      const result = await useCase.execute(managerTenant, currentUser, 'request-1')

      expect(result).toMatchObject({ status: DocumentRequestStatus.APPROVED, reviewedByUserId: 'agent-1' })
      expect(repository.reviewRequest).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        reviewedByUserId: 'agent-1',
        status: DocumentRequestStatus.APPROVED,
        versionStatus: DocumentVersionStatus.APPROVED,
        rejectionReason: null,
      })
    })

    it('allows the requesting seller to approve their own submitted request', async () => {
      const repository = {
        findInternalRequestDetail: vi.fn().mockResolvedValue(submittedRequest),
        reviewRequest: vi.fn().mockResolvedValue({ ...submittedRequest, status: DocumentRequestStatus.APPROVED }),
      }
      const useCase = new ApproveDocumentRequestUseCase(repository as never)

      await expect(useCase.execute(sellerTenant, currentUser, 'request-1')).resolves.toMatchObject({
        status: DocumentRequestStatus.APPROVED,
      })
      expect(repository.findInternalRequestDetail).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        viewerUserId: 'agent-1',
        canViewAll: false,
      })
    })

    it('returns not found when a peer seller approves another seller request', async () => {
      const repository = { findInternalRequestDetail: vi.fn().mockResolvedValue(null), reviewRequest: vi.fn() }
      const useCase = new ApproveDocumentRequestUseCase(repository as never)

      await expect(useCase.execute(sellerTenant, { id: 'seller-2', email: 'seller2@example.com' }, 'request-1')).rejects.toThrow(
        new NotFoundException('Document request not found'),
      )
      expect(repository.reviewRequest).not.toHaveBeenCalled()
    })
  })

  describe('RejectDocumentRequestUseCase', () => {
    it('rejects a submitted request and marks the current version rejected', async () => {
      const rejectedRequest = {
        ...submittedRequest,
        status: DocumentRequestStatus.REJECTED,
        reviewedByUserId: 'agent-1',
        reviewedAt: new Date('2026-01-05T00:00:00.000Z'),
        rejectionReason: 'The uploaded deed is expired.',
        document: { currentVersion: { ...currentVersion, status: DocumentVersionStatus.REJECTED }, versions: [] },
      }
      const repository = {
        findInternalRequestDetail: vi.fn().mockResolvedValue(submittedRequest),
        reviewRequest: vi.fn().mockResolvedValue(rejectedRequest),
      }
      const useCase = new RejectDocumentRequestUseCase(repository as never)

      const result = await useCase.execute(sellerTenant, currentUser, 'request-1', {
        reason: '  The uploaded deed is expired.  ',
      })

      expect(result).toMatchObject({
        status: DocumentRequestStatus.REJECTED,
        rejectionReason: 'The uploaded deed is expired.',
        currentVersion: { status: DocumentVersionStatus.REJECTED },
      })
      expect(repository.reviewRequest).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        requestId: 'request-1',
        reviewedByUserId: 'agent-1',
        status: DocumentRequestStatus.REJECTED,
        versionStatus: DocumentVersionStatus.REJECTED,
        rejectionReason: 'The uploaded deed is expired.',
      })
    })

    it('requires a non-empty rejection reason', async () => {
      const repository = { findInternalRequestDetail: vi.fn(), reviewRequest: vi.fn() }
      const useCase = new RejectDocumentRequestUseCase(repository as never)

      await expect(useCase.execute(managerTenant, currentUser, 'request-1', { reason: '   ' })).rejects.toThrow(
        new BadRequestException('Rejection reason is required'),
      )
      expect(repository.findInternalRequestDetail).not.toHaveBeenCalled()
    })
  })

  describe('CreateInternalDocumentReadUrlUseCase', () => {
    it('allows a manager to create a read URL for a tenant document version', async () => {
      const repository = { findInternalReadableVersion: vi.fn().mockResolvedValue(currentVersion) }
      const storage = {
        createReadUrl: vi.fn().mockResolvedValue({
          url: 'https://storage.example/read/documents/request-1/version-1.pdf',
          storageKey: currentVersion.storageKey,
          expiresInSeconds: 300,
        }),
      }
      const useCase = new CreateInternalDocumentReadUrlUseCase(repository as never, storage as never)

      const result = await useCase.execute(managerTenant, currentUser, 'version-1')

      expect(result).toMatchObject({ version: { id: 'version-1' }, readUrl: { expiresInSeconds: 300 } })
      expect(repository.findInternalReadableVersion).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        versionId: 'version-1',
        viewerUserId: 'agent-1',
        canViewAll: true,
      })
      expect(storage.createReadUrl).toHaveBeenCalledWith({ storageKey: currentVersion.storageKey, expiresInSeconds: 300 })
    })

    it('allows the requesting seller to create a read URL for their own request version', async () => {
      const repository = { findInternalReadableVersion: vi.fn().mockResolvedValue(currentVersion) }
      const storage = { createReadUrl: vi.fn().mockResolvedValue({ url: 'https://storage.example/read', storageKey: currentVersion.storageKey, expiresInSeconds: 300 }) }
      const useCase = new CreateInternalDocumentReadUrlUseCase(repository as never, storage as never)

      await expect(useCase.execute(sellerTenant, currentUser, 'version-1')).resolves.toMatchObject({ version: { id: 'version-1' } })
      expect(repository.findInternalReadableVersion).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        versionId: 'version-1',
        viewerUserId: 'agent-1',
        canViewAll: false,
      })
    })

    it('returns not found for a peer seller document version', async () => {
      const repository = { findInternalReadableVersion: vi.fn().mockResolvedValue(null) }
      const storage = { createReadUrl: vi.fn() }
      const useCase = new CreateInternalDocumentReadUrlUseCase(repository as never, storage as never)

      await expect(useCase.execute(sellerTenant, { id: 'seller-2', email: 'seller2@example.com' }, 'version-1')).rejects.toThrow(
        new NotFoundException('Document version not found'),
      )
      expect(storage.createReadUrl).not.toHaveBeenCalled()
    })
  })
})
