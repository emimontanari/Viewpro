import {
  AnalyticsActorType,
  AnalyticsEventName,
  DocumentRequestStatus,
  GlobalRole,
  MovementSource,
  MovementType,
  PrismaClient,
  PropertyEngagementStatus,
  PropertyOperationType,
  PropertyType,
  TenantRole,
  TenantStatus,
  UserStatus,
} from '@prisma/client'
import { argon2id, hash } from 'argon2'
import { randomUUID } from 'node:crypto'

const fixtureRunId = randomUUID()

function createRuntimeLoginValue(label: string) {
  return `seeded-auth-e2e-${label}-${fixtureRunId}`
}

export const seededAuthFixture = {
  tenant: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Aurora Propiedades Seeded',
    slug: 'aurora-seeded-e2e',
  },
  manager: {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'manager.seeded@viewpro.test',
    loginValue: createRuntimeLoginValue('manager'),
  },
  admin: {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'admin.seeded@viewpro.test',
    loginValue: createRuntimeLoginValue('admin'),
  },
  owner: {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'owner.seeded@viewpro.test',
  },
  property: {
    id: '55555555-5555-4555-8555-555555555555',
    title: 'Departamento Seeded Palermo',
  },
  engagement: {
    id: '66666666-6666-4666-8666-666666666666',
  },
  movement: {
    id: '77777777-7777-4777-8777-777777777777',
  },
  documentRequest: {
    id: '88888888-8888-4888-8888-888888888888',
  },
  analytics: {
    movementEventId: '99999999-9999-4999-8999-999999999999',
    documentEventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
} as const

const seededUserEmails = [seededAuthFixture.manager.email, seededAuthFixture.admin.email, seededAuthFixture.owner.email]

export async function resetSeededAuthFixture() {
  const prisma = new PrismaClient()

  try {
    await deleteSeededRows(prisma)
    await createSeededRows(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

async function deleteSeededRows(prisma: PrismaClient) {
  await prisma.analyticsEvent.deleteMany({
    where: {
      OR: [
        { id: { in: [seededAuthFixture.analytics.movementEventId, seededAuthFixture.analytics.documentEventId] } },
        { tenantId: seededAuthFixture.tenant.id },
      ],
    },
  })
  await prisma.documentVersion.deleteMany({ where: { document: { documentRequestId: seededAuthFixture.documentRequest.id } } })
  await prisma.document.deleteMany({ where: { documentRequestId: seededAuthFixture.documentRequest.id } })
  await prisma.documentRequest.deleteMany({ where: { id: seededAuthFixture.documentRequest.id } })
  await prisma.movement.deleteMany({ where: { id: seededAuthFixture.movement.id } })
  await prisma.propertyAgent.deleteMany({ where: { propertyEngagementId: seededAuthFixture.engagement.id } })
  await prisma.propertyEngagement.deleteMany({ where: { id: seededAuthFixture.engagement.id } })
  await prisma.propertyAssetOwner.deleteMany({ where: { propertyAssetId: seededAuthFixture.property.id } })
  await prisma.propertyAsset.deleteMany({ where: { id: seededAuthFixture.property.id } })
  await prisma.refreshToken.deleteMany({ where: { user: { email: { in: seededUserEmails } } } })
  await prisma.tenantMembership.deleteMany({
    where: {
      OR: [{ tenantId: seededAuthFixture.tenant.id }, { user: { email: { in: seededUserEmails } } }],
    },
  })
  await prisma.tenant.deleteMany({ where: { OR: [{ id: seededAuthFixture.tenant.id }, { slug: seededAuthFixture.tenant.slug }] } })
  await prisma.user.deleteMany({ where: { email: { in: seededUserEmails } } })
}

async function createSeededRows(prisma: PrismaClient) {
  const [managerPasswordHash, adminPasswordHash, ownerPasswordHash] = await Promise.all([
    hash(seededAuthFixture.manager.loginValue, { type: argon2id }),
    hash(seededAuthFixture.admin.loginValue, { type: argon2id }),
    hash(createRuntimeLoginValue('owner-disabled'), { type: argon2id }),
  ])

  const manager = await prisma.user.create({
    data: {
      id: seededAuthFixture.manager.id,
      email: seededAuthFixture.manager.email,
      passwordHash: managerPasswordHash,
      firstName: 'Seeded',
      lastName: 'Manager',
      status: UserStatus.ACTIVE,
      globalRole: GlobalRole.USER,
      emailVerifiedAt: new Date('2026-05-18T10:00:00.000Z'),
    },
  })
  const admin = await prisma.user.create({
    data: {
      id: seededAuthFixture.admin.id,
      email: seededAuthFixture.admin.email,
      passwordHash: adminPasswordHash,
      firstName: 'Seeded',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      globalRole: GlobalRole.VIEWPRO_ADMIN,
      emailVerifiedAt: new Date('2026-05-18T10:00:00.000Z'),
    },
  })
  const owner = await prisma.user.create({
    data: {
      id: seededAuthFixture.owner.id,
      email: seededAuthFixture.owner.email,
      passwordHash: ownerPasswordHash,
      firstName: 'Seeded',
      lastName: 'Owner',
      status: UserStatus.ACTIVE,
      globalRole: GlobalRole.USER,
    },
  })
  const tenant = await prisma.tenant.create({
    data: {
      id: seededAuthFixture.tenant.id,
      name: seededAuthFixture.tenant.name,
      slug: seededAuthFixture.tenant.slug,
      status: TenantStatus.ACTIVE,
    },
  })

  await prisma.tenantMembership.create({
    data: {
      tenantId: tenant.id,
      userId: manager.id,
      role: TenantRole.MANAGER,
    },
  })

  const propertyAsset = await prisma.propertyAsset.create({
    data: {
      id: seededAuthFixture.property.id,
      title: seededAuthFixture.property.title,
      addressLine: 'Av. Santa Fe 1234',
      city: 'Buenos Aires',
      province: 'CABA',
      propertyType: PropertyType.APARTMENT,
      ownerName: 'Seeded Owner',
      ownerEmail: seededAuthFixture.owner.email,
      createdByUserId: manager.id,
    },
  })
  await prisma.propertyAssetOwner.create({
    data: {
      propertyAssetId: propertyAsset.id,
      userId: owner.id,
      isPrimary: true,
      accessStatus: 'ACTIVE',
    },
  })
  const engagement = await prisma.propertyEngagement.create({
    data: {
      id: seededAuthFixture.engagement.id,
      tenantId: tenant.id,
      propertyAssetId: propertyAsset.id,
      operationType: PropertyOperationType.SALE,
      status: PropertyEngagementStatus.ACTIVE_PUBLICATION,
      publishedPriceCents: 18500000,
      currency: 'USD',
      createdByUserId: manager.id,
    },
  })
  const movement = await prisma.movement.create({
    data: {
      id: seededAuthFixture.movement.id,
      tenantId: tenant.id,
      propertyEngagementId: engagement.id,
      createdByUserId: manager.id,
      type: MovementType.GENERAL_UPDATE,
      observation: 'Seeded E2E movement for authenticated workspace coverage.',
      nextStep: 'Validate seeded browser coverage.',
      source: MovementSource.SYSTEM,
      createdAt: new Date('2026-05-18T11:00:00.000Z'),
    },
  })
  const documentRequest = await prisma.documentRequest.create({
    data: {
      id: seededAuthFixture.documentRequest.id,
      tenantId: tenant.id,
      propertyEngagementId: engagement.id,
      ownerUserId: owner.id,
      requestedByUserId: manager.id,
      title: 'Seeded E2E Escritura',
      description: 'Deterministic document request for admin read models.',
      status: DocumentRequestStatus.PENDING,
    },
  })

  await prisma.analyticsEvent.createMany({
    data: [
      {
        id: seededAuthFixture.analytics.movementEventId,
        tenantId: tenant.id,
        actorUserId: manager.id,
        actorType: AnalyticsActorType.INTERNAL_USER,
        eventName: AnalyticsEventName.MOVEMENT_CREATED,
        propertyEngagementId: engagement.id,
        propertyAssetId: propertyAsset.id,
        movementId: movement.id,
        metadata: { source: 'seeded-auth-e2e' },
        occurredAt: new Date('2026-05-18T11:00:00.000Z'),
      },
      {
        id: seededAuthFixture.analytics.documentEventId,
        tenantId: tenant.id,
        actorUserId: admin.id,
        actorType: AnalyticsActorType.INTERNAL_USER,
        eventName: AnalyticsEventName.DOCUMENT_REQUESTED,
        propertyEngagementId: engagement.id,
        propertyAssetId: propertyAsset.id,
        documentRequestId: documentRequest.id,
        metadata: { source: 'seeded-auth-e2e' },
        occurredAt: new Date('2026-05-18T12:00:00.000Z'),
      },
    ],
  })
}
