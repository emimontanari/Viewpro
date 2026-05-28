import { DocumentRequestStatus, PropertyAssetOwnerAccessStatus, PropertyOperationType, PropertyType } from '@prisma/client'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

describe('Owner document endpoints (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'

    app = await createApiApp()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.documentVersion.deleteMany()
    await prisma.document.deleteMany()
    await prisma.documentRequest.deleteMany()
    await prisma.movement.deleteMany()
    await prisma.propertyAgent.deleteMany()
    await prisma.propertyEngagement.deleteMany()
    await prisma.propertyAssetOwner.deleteMany()
    await prisma.propertyAsset.deleteMany()
    await prisma.refreshToken.deleteMany()
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await app.close()
  })

  it('lets an owner list and read only requests addressed to them without x-tenant-id', async () => {
    const manager = await registerTenantSession('owner-documents-manager@example.com', 'Owner Documents Tenant')
    const owner = await registerOwnerSession('owner-documents-owner@example.com')
    const otherOwner = await registerOwnerSession('owner-documents-other@example.com')
    const owned = await createEngagement(manager.agent, manager.tenantId, { title: 'Owner Visible Document Property' }).expect(201)
    const otherOwned = await createEngagement(manager.agent, manager.tenantId, { title: 'Owner Second Visible Document Property' }).expect(201)
    const hidden = await createEngagement(manager.agent, manager.tenantId, { title: 'Owner Hidden Document Property' }).expect(201)
    const ownerLink = await grantOwnerAccess(owner.userId, owned.body.property.id)
    const otherOwnerLink = await grantOwnerAccess(otherOwner.userId, hidden.body.property.id)
    const otherVisibleLink = await grantOwnerAccess(owner.userId, otherOwned.body.property.id)
    const visibleRequest = await createInternalRequest(manager.agent, manager.tenantId, owned.body.id, ownerLink.id, 'Visible deed').expect(201)
    const otherVisibleRequest = await createInternalRequest(
      manager.agent,
      manager.tenantId,
      otherOwned.body.id,
      otherVisibleLink.id,
      'Second visible deed',
    ).expect(201)
    const hiddenRequest = await createInternalRequest(manager.agent, manager.tenantId, hidden.body.id, otherOwnerLink.id, 'Hidden deed').expect(201)

    const list = await owner.agent.get('/api/owner/document-requests').expect(200)
    const filteredList = await owner.agent.get(`/api/owner/document-requests?propertyEngagementId=${owned.body.id}`).expect(200)
    const hiddenFilteredList = await owner.agent.get(`/api/owner/document-requests?propertyEngagementId=${hidden.body.id}`).expect(200)
    const detail = await owner.agent.get(`/api/owner/document-requests/${visibleRequest.body.id}`).expect(200)
    const otherDetail = await owner.agent.get(`/api/owner/document-requests/${hiddenRequest.body.id}`).expect(404)

    expect(list.body.total).toBe(2)
    expect(list.body.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([visibleRequest.body.id, otherVisibleRequest.body.id]),
    )
    expect(filteredList.body.total).toBe(1)
    expect(filteredList.body.items.map((item: { id: string }) => item.id)).toEqual([visibleRequest.body.id])
    expect(hiddenFilteredList.body.total).toBe(0)
    expect(detail.body).toMatchObject({
      id: visibleRequest.body.id,
      propertyAssetOwnerId: ownerLink.id,
      ownerUserId: owner.userId,
      title: 'Visible deed',
    })
    expect(otherDetail.body.message).toBe('Document request not found')
  })

  it('validates owner upload URL MIME and size before returning fake signed URL metadata', async () => {
    const { owner, documentRequest } = await setupOwnerDocumentRequest('owner-upload-validation')

    const invalidMime = await owner.agent
      .post(`/api/owner/document-requests/${documentRequest.body.id}/upload-url`)
      .send({ originalFilename: 'deed.txt', mimeType: 'text/plain', sizeBytes: 1024 })
      .expect(400)
    const tooLarge = await owner.agent
      .post(`/api/owner/document-requests/${documentRequest.body.id}/upload-url`)
      .send({ originalFilename: 'deed.pdf', mimeType: 'application/pdf', sizeBytes: 10 * 1024 * 1024 + 1 })
      .expect(400)
    const success = await owner.agent
      .post(`/api/owner/document-requests/${documentRequest.body.id}/upload-url`)
      .send({ originalFilename: 'Deed.pdf', mimeType: 'application/pdf', sizeBytes: 1024, checksum: 'sha256:abc123' })
      .expect(201)

    expect(invalidMime.body.message).toBe('Unsupported document MIME type')
    expect(tooLarge.body.message).toEqual(expect.arrayContaining(['sizeBytes must not be greater than 10485760']))
    expect(success.body).toMatchObject({
      request: { id: documentRequest.body.id, status: DocumentRequestStatus.PENDING },
      version: { status: 'PENDING_UPLOAD', originalFilename: 'Deed.pdf', uploadedByUserId: owner.userId },
      uploadUrl: { expiresInSeconds: 600, storageKey: `document-requests/${documentRequest.body.id}/deed.pdf` },
    })
    expect(success.body.uploadUrl.url).toContain('https://fake-documents.local/upload/')
  })

  it('confirms an owner upload, submits the request, and returns owner read URLs', async () => {
    const { owner, documentRequest } = await setupOwnerDocumentRequest('owner-upload-confirm')
    const upload = await owner.agent
      .post(`/api/owner/document-requests/${documentRequest.body.id}/upload-url`)
      .send({ originalFilename: 'photo.png', mimeType: 'image/png', sizeBytes: 2048 })
      .expect(201)

    const confirmed = await owner.agent.post(`/api/owner/document-versions/${upload.body.version.id}/confirm-upload`).expect(201)
    const detail = await owner.agent.get(`/api/owner/document-requests/${documentRequest.body.id}`).expect(200)
    const readUrl = await owner.agent.post(`/api/owner/document-versions/${upload.body.version.id}/read-url`).expect(201)

    expect(confirmed.body).toMatchObject({ id: upload.body.version.id, status: 'UPLOADED' })
    expect(detail.body).toMatchObject({ id: documentRequest.body.id, status: DocumentRequestStatus.SUBMITTED, currentVersion: { id: upload.body.version.id } })
    expect(readUrl.body).toMatchObject({ version: { id: upload.body.version.id }, readUrl: { expiresInSeconds: 300 } })
  })

  it('prevents another owner from uploading, confirming, or reading someone else’s document version', async () => {
    const { owner, otherOwner, documentRequest } = await setupOwnerDocumentRequest('owner-cross-access')
    const upload = await owner.agent
      .post(`/api/owner/document-requests/${documentRequest.body.id}/upload-url`)
      .send({ originalFilename: 'deed.pdf', mimeType: 'application/pdf', sizeBytes: 1024 })
      .expect(201)

    const otherUpload = await otherOwner.agent
      .post(`/api/owner/document-requests/${documentRequest.body.id}/upload-url`)
      .send({ originalFilename: 'other.pdf', mimeType: 'application/pdf', sizeBytes: 1024 })
      .expect(404)
    const otherConfirm = await otherOwner.agent.post(`/api/owner/document-versions/${upload.body.version.id}/confirm-upload`).expect(404)
    await owner.agent.post(`/api/owner/document-versions/${upload.body.version.id}/confirm-upload`).expect(201)
    const otherRead = await otherOwner.agent.post(`/api/owner/document-versions/${upload.body.version.id}/read-url`).expect(404)

    expect(otherUpload.body.message).toBe('Document request not found')
    expect(otherConfirm.body.message).toBe('Document version not found')
    expect(otherRead.body.message).toBe('Document version not found')
  })

  it('rejects unauthenticated owner document requests', async () => {
    const response = await request(app.getHttpServer()).get('/api/owner/document-requests').expect(401)

    expect(response.body.message).toBe('Authentication required')
  })

  async function setupOwnerDocumentRequest(seed: string) {
    const manager = await registerTenantSession(`${seed}-manager@example.com`, `${seed} Tenant`)
    const owner = await registerOwnerSession(`${seed}-owner@example.com`)
    const otherOwner = await registerOwnerSession(`${seed}-other@example.com`)
    const engagement = await createEngagement(manager.agent, manager.tenantId, { title: `${seed} Property` }).expect(201)
    const ownerLink = await grantOwnerAccess(owner.userId, engagement.body.property.id)
    const documentRequest = await createInternalRequest(manager.agent, manager.tenantId, engagement.body.id, ownerLink.id, `${seed} deed`).expect(201)
    return { manager, owner, otherOwner, engagement, ownerLink, documentRequest }
  }

  async function registerTenantSession(email: string, tenantName: string) {
    const agent = request.agent(app.getHttpServer())
    const response = await agent
      .post('/api/auth/register-tenant')
      .send({ email, password: 'password123', firstName: 'OwnerDocument', tenantName })
      .expect(201)

    return { agent, userId: response.body.user.id as string, tenantId: response.body.memberships[0].tenant.id as string }
  }

  async function registerOwnerSession(email: string) {
    const owner = await registerTenantSession(email, `Temporary ${email}`)
    await prisma.tenantMembership.deleteMany({ where: { userId: owner.userId } })
    return owner
  }

  function createEngagement(agent: ReturnType<typeof request.agent>, tenantId: string, overrides: Partial<Record<string, unknown>> = {}) {
    return agent
      .post('/api/property-engagements')
      .set('x-tenant-id', tenantId)
      .send({
        title: 'Default Owner Document Property',
        addressLine: 'Owner Document Street 123',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.HOUSE,
        operationType: PropertyOperationType.RENT,
        ...overrides,
      })
  }

  function createInternalRequest(
    agent: ReturnType<typeof request.agent>,
    tenantId: string,
    engagementId: string,
    propertyAssetOwnerId: string,
    title: string,
  ) {
    return agent
      .post(`/api/property-engagements/${engagementId}/document-requests`)
      .set('x-tenant-id', tenantId)
      .send({ propertyAssetOwnerId, title })
  }

  async function grantOwnerAccess(
    userId: string,
    propertyAssetId: string,
    accessStatus: PropertyAssetOwnerAccessStatus = PropertyAssetOwnerAccessStatus.ACTIVE,
  ) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    })

    return prisma.propertyAssetOwner.create({
      data: {
        userId,
        propertyAssetId,
        ownerEmail: user.email.toLowerCase(),
        ownerFirstName: user.firstName,
        ownerLastName: user.lastName ?? '',
        accessStatus,
      },
    })
  }
})
