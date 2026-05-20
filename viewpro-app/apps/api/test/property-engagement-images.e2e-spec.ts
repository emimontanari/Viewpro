import { PropertyOperationType, PropertyType } from '@prisma/client'
import type { INestApplication } from '@nestjs/common'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createApiApp } from '../src/bootstrap/create-app'
import { PrismaService } from '../src/database/prisma.service'

type TestAgent = ReturnType<typeof request.agent>

const TEST_UPLOADS_ROOT = join(
  process.env.PROPERTY_IMAGES_UPLOADS_ROOT ?? join(process.cwd(), 'uploads'),
  'property-images',
)

describe('Property engagement images (e2e)', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.ACCESS_TOKEN_SECRET = 'test-access-token-secret'
    process.env.COOKIE_DOMAIN = 'localhost'
    process.env.COOKIE_SECURE = 'false'
    process.env.API_PUBLIC_URL = 'http://localhost:3001'

    app = await createApiApp()
    await app.init()
    prisma = app.get(PrismaService)
  })

  beforeEach(async () => {
    await prisma.propertyAssetImage.deleteMany()
    await prisma.movement.deleteMany()
    await prisma.propertyAgent.deleteMany()
    await prisma.propertyEngagement.deleteMany()
    await prisma.propertyAsset.deleteMany()
    await prisma.refreshToken.deleteMany()
    await prisma.tenantMembership.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.user.deleteMany()
    await rm(TEST_UPLOADS_ROOT, { force: true, recursive: true })
  })

  afterAll(async () => {
    await rm(TEST_UPLOADS_ROOT, { force: true, recursive: true })
    await app.close()
  })

  it('allows a manager to upload one primary image for a tenant property engagement', async () => {
    const manager = await registerTenantSession(
      'image-manager@example.com',
      'Image Manager Homes',
    )
    const engagement = await createEngagement(manager.agent, manager.tenantId, {
      title: 'Image Property',
    }).expect(201)

    const upload = await manager.agent
      .post(`/api/property-engagements/${engagement.body.id}/images`)
      .set('x-tenant-id', manager.tenantId)
      .attach('image', Buffer.from('fake png bytes'), {
        filename: 'front.png',
        contentType: 'image/png',
      })
      .expect(201)

    expect(upload.body).toMatchObject({
      originalFilename: 'front.png',
      mimeType: 'image/png',
      sizeBytes: 14,
      isPrimary: true,
    })
    expect(upload.body.url).toContain('/uploads/property-images/')
    await expect(
      prisma.propertyAssetImage.count({
        where: { propertyAssetId: engagement.body.property.id },
      }),
    ).resolves.toBe(1)

    const list = await manager.agent
      .get('/api/property-engagements')
      .set('x-tenant-id', manager.tenantId)
      .expect(200)
    expect(list.body.items[0].property.primaryImage).toMatchObject({
      id: upload.body.id,
      url: upload.body.url,
    })
    expect(list.body.items[0].property.images).toHaveLength(1)

    const imagePath = new URL(upload.body.url).pathname
    await manager.agent.get(imagePath).expect(200)
  })

  it('allows up to five images and rejects the sixth', async () => {
    const manager = await registerTenantSession(
      'image-limit@example.com',
      'Image Limit Homes',
    )
    const engagement = await createEngagement(manager.agent, manager.tenantId, {
      title: 'Image Limit Property',
    }).expect(201)
    let fifthUploadId = ''

    for (let index = 1; index <= 5; index += 1) {
      const upload = await manager.agent
        .post(`/api/property-engagements/${engagement.body.id}/images`)
        .set('x-tenant-id', manager.tenantId)
        .attach('image', Buffer.from(`fake png bytes ${index}`), {
          filename: `image-${index}.png`,
          contentType: 'image/png',
        })
        .expect(201)

      if (index === 5) {
        fifthUploadId = upload.body.id
      }
    }

    const response = await manager.agent
      .post(`/api/property-engagements/${engagement.body.id}/images`)
      .set('x-tenant-id', manager.tenantId)
      .attach('image', Buffer.from('fake png bytes 6'), {
        filename: 'image-6.png',
        contentType: 'image/png',
      })
      .expect(400)

    expect(response.body.message).toBe('A property can have up to 5 images')
    await expect(
      prisma.propertyAssetImage.count({
        where: { propertyAssetId: engagement.body.property.id },
      }),
    ).resolves.toBe(5)

    const detail = await manager.agent
      .get(`/api/property-engagements/${engagement.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .expect(200)
    expect(detail.body.property.images).toHaveLength(5)
    expect(detail.body.property.primaryImage.id).toBe(fifthUploadId)
  })

  it('rejects non-image uploads', async () => {
    const manager = await registerTenantSession(
      'image-invalid@example.com',
      'Image Invalid Homes',
    )
    const engagement = await createEngagement(
      manager.agent,
      manager.tenantId,
    ).expect(201)

    const response = await manager.agent
      .post(`/api/property-engagements/${engagement.body.id}/images`)
      .set('x-tenant-id', manager.tenantId)
      .attach('image', Buffer.from('plain text'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(400)

    expect(response.body.message).toBe(
      'Property image must be a JPEG, PNG, or WebP file',
    )
    await expect(prisma.propertyAssetImage.count()).resolves.toBe(0)
  })

  it('hides another tenant engagement when uploading an image', async () => {
    const tenantA = await registerTenantSession(
      'image-tenant-a@example.com',
      'Image Tenant A',
    )
    const tenantB = await registerTenantSession(
      'image-tenant-b@example.com',
      'Image Tenant B',
    )
    const engagementB = await createEngagement(
      tenantB.agent,
      tenantB.tenantId,
      { title: 'Tenant B Image Property' },
    ).expect(201)

    const response = await tenantA.agent
      .post(`/api/property-engagements/${engagementB.body.id}/images`)
      .set('x-tenant-id', tenantA.tenantId)
      .attach('image', Buffer.from('fake png bytes'), {
        filename: 'front.png',
        contentType: 'image/png',
      })
      .expect(404)

    expect(response.body.message).toBe('Property engagement not found')
    await expect(prisma.propertyAssetImage.count()).resolves.toBe(0)
  })

  it('allows a manager to delete an image from a tenant property engagement', async () => {
    const manager = await registerTenantSession(
      'image-delete@example.com',
      'Image Delete Homes',
    )
    const engagement = await createEngagement(manager.agent, manager.tenantId, {
      title: 'Image Delete Property',
    }).expect(201)
    const upload = await uploadImage(
      manager.agent,
      manager.tenantId,
      engagement.body.id,
      'delete-me.png',
    )

    const response = await manager.agent
      .delete(
        `/api/property-engagements/${engagement.body.id}/images/${upload.body.id}`,
      )
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(response.body).toEqual({ deleted: true, id: upload.body.id })
    await expect(
      prisma.propertyAssetImage.count({
        where: { propertyAssetId: engagement.body.property.id },
      }),
    ).resolves.toBe(0)

    const imagePath = new URL(upload.body.url).pathname
    await manager.agent.get(imagePath).expect(404)
  })

  it('hides another tenant engagement when deleting an image', async () => {
    const tenantA = await registerTenantSession(
      'image-delete-tenant-a@example.com',
      'Image Delete Tenant A',
    )
    const tenantB = await registerTenantSession(
      'image-delete-tenant-b@example.com',
      'Image Delete Tenant B',
    )
    const engagementB = await createEngagement(
      tenantB.agent,
      tenantB.tenantId,
      { title: 'Tenant B Delete Image Property' },
    ).expect(201)
    const uploadB = await uploadImage(
      tenantB.agent,
      tenantB.tenantId,
      engagementB.body.id,
      'tenant-b.png',
    )

    const response = await tenantA.agent
      .delete(
        `/api/property-engagements/${engagementB.body.id}/images/${uploadB.body.id}`,
      )
      .set('x-tenant-id', tenantA.tenantId)
      .expect(404)

    expect(response.body.message).toBe('Property engagement not found')
    await expect(prisma.propertyAssetImage.count()).resolves.toBe(1)
  })

  it('returns 404 when deleting an image that does not belong to the engagement', async () => {
    const manager = await registerTenantSession(
      'image-delete-non-owned@example.com',
      'Image Delete Non Owned Homes',
    )
    const engagementA = await createEngagement(
      manager.agent,
      manager.tenantId,
      { title: 'Image Delete Property A' },
    ).expect(201)
    const engagementB = await createEngagement(
      manager.agent,
      manager.tenantId,
      { title: 'Image Delete Property B' },
    ).expect(201)
    const uploadB = await uploadImage(
      manager.agent,
      manager.tenantId,
      engagementB.body.id,
      'property-b.png',
    )

    const response = await manager.agent
      .delete(
        `/api/property-engagements/${engagementA.body.id}/images/${uploadB.body.id}`,
      )
      .set('x-tenant-id', manager.tenantId)
      .expect(404)

    expect(response.body.message).toBe('Property image not found')
    await expect(
      prisma.propertyAssetImage.count({
        where: { propertyAssetId: engagementB.body.property.id },
      }),
    ).resolves.toBe(1)
  })

  it('promotes the newest remaining image when deleting the primary image', async () => {
    const manager = await registerTenantSession(
      'image-delete-primary@example.com',
      'Image Delete Primary Homes',
    )
    const engagement = await createEngagement(manager.agent, manager.tenantId, {
      title: 'Image Delete Primary Property',
    }).expect(201)
    const firstUpload = await uploadImage(
      manager.agent,
      manager.tenantId,
      engagement.body.id,
      'first.png',
    )
    const secondUpload = await uploadImage(
      manager.agent,
      manager.tenantId,
      engagement.body.id,
      'second.png',
    )

    await manager.agent
      .delete(
        `/api/property-engagements/${engagement.body.id}/images/${secondUpload.body.id}`,
      )
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    const detail = await manager.agent
      .get(`/api/property-engagements/${engagement.body.id}`)
      .set('x-tenant-id', manager.tenantId)
      .expect(200)

    expect(detail.body.property.images).toHaveLength(1)
    expect(detail.body.property.primaryImage).toMatchObject({
      id: firstUpload.body.id,
      isPrimary: true,
    })
  })

  async function registerTenantSession(email: string, tenantName: string) {
    const agent = request.agent(app.getHttpServer())
    const response = await agent
      .post('/api/auth/register-tenant')
      .send({ email, password: 'password123', firstName: 'Image', tenantName })
      .expect(201)

    return {
      agent,
      userId: response.body.user.id as string,
      tenantId: response.body.memberships[0].tenant.id as string,
    }
  }

  function uploadImage(
    agent: TestAgent,
    tenantId: string,
    engagementId: string,
    filename: string,
  ) {
    return agent
      .post(`/api/property-engagements/${engagementId}/images`)
      .set('x-tenant-id', tenantId)
      .attach('image', Buffer.from(`fake png bytes ${filename}`), {
        filename,
        contentType: 'image/png',
      })
      .expect(201)
  }

  function createEngagement(
    agent: TestAgent,
    tenantId: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return agent
      .post('/api/property-engagements')
      .set('x-tenant-id', tenantId)
      .send({
        title: 'Default Image Property',
        addressLine: 'Image Street 123',
        city: 'Buenos Aires',
        province: 'CABA',
        propertyType: PropertyType.HOUSE,
        operationType: PropertyOperationType.RENT,
        ...overrides,
      })
  }
})
