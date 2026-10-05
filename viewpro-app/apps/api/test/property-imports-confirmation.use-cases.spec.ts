import { randomUUID } from 'node:crypto'
import { ForbiddenException } from '@nestjs/common'
import { PrismaClient, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ConfirmImportCandidatesUseCase } from '../src/property-imports/confirmation.use-cases'
import { PrismaPropertyImportStagingRepository } from '../src/property-imports/prisma-property-imports.repository'
import { CreateImportBatchUseCase, StageImportCandidatesUseCase } from '../src/property-imports/staging.use-cases'

const prisma = new PrismaClient()
const repository = new PrismaPropertyImportStagingRepository(prisma as never)
let tenantId: string, userId: string, batchId: string
const context = (permissions: string[] = ['engagements.create']) => ({ tenantId, tenantSlug: tenantId, tenantStatus: TenantStatus.ACTIVE, membershipId: 'member', role: TenantRole.PRINCIPAL_MANAGER, permissions, userStatus: UserStatus.ACTIVE })
const actor = () => ({ id: userId, email: 'user@test.invalid' })
const input = (externalId: string) => ({ externalId, sourceUrl: `https://www.zonaprop.com.ar/propiedades/clasificado/${externalId}.html`, title: 'Casa', addressLine: 'Calle 1', locationParts: ['Nueva Córdoba', 'Córdoba', 'Córdoba'], typeLabel: 'Casa', operationLabel: 'Venta', priceAmount: 100, priceCurrency: 'ARS', features: [{ code: 'CFT1', value: '3 ambientes' }], publisherId: '123', sourceSnapshot: { title: 'Casa' } })
const stage = (ids: string[]) => new StageImportCandidatesUseCase(repository).execute(context(), batchId, ids.map(input))
const confirm = (permissions?: string[]) => new ConfirmImportCandidatesUseCase(repository).execute(context(permissions), actor(), batchId)
afterAll(async () => prisma.$disconnect())
beforeEach(async () => {
  const id = randomUUID(); tenantId = `u3b-${id}`; userId = `u3b-user-${id}`
  await prisma.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId } })
  await prisma.user.create({ data: { id: userId, email: `${id}@test.invalid`, passwordHash: 'test', firstName: 'Test' } })
  batchId = (await new CreateImportBatchUseCase(repository).execute(context(), actor(), 'https://www.zonaprop.com.ar/inmobiliarias/agencia_123-inmuebles.html')).id
  await prisma.publisherClaim.create({ data: { tenantId, externalSource: 'ZONAPROP', publisherId: '123', state: 'APPROVED' } })
})
afterEach(async () => { await prisma.tenant.deleteMany({ where: { id: tenantId } }); await prisma.propertyAsset.deleteMany({ where: { createdByUserId: userId } }); await prisma.user.deleteMany({ where: { id: userId } }) })

describe('property import confirmation', () => {
  it('creates attributed canonical records once, including on repeated and concurrent confirmation', async () => {
    await stage(['one', 'two'])
    const results = await Promise.all([confirm(), confirm()])
    expect(results.reduce((n, result) => n + result.imported, 0)).toBe(2)
    // Rows taken by the sibling confirmation are reported as skipped, never as "existing" or silently dropped.
    expect(results.reduce((n, result) => n + result.existing, 0)).toBe(0)
    for (const result of results) expect(result.outcomes).toHaveLength(2)
    expect((await confirm()).imported).toBe(0)
    expect(await prisma.externalPropertyReference.count({ where: { tenantId } })).toBe(2)
    expect(await prisma.propertyEngagement.count({ where: { tenantId, createdByUserId: userId } })).toBe(2)
    expect(await prisma.propertyAsset.count({ where: { createdByUserId: userId } })).toBe(2)
    expect(await prisma.propertyImportCandidate.findMany({ where: { tenantId }, select: { state: true, errorReason: true } })).toEqual([{ state: 'IMPORTED', errorReason: null }, { state: 'IMPORTED', errorReason: null }])
  })
  it('rejects absent and pending publisher claims', async () => {
    await prisma.publisherClaim.deleteMany({ where: { tenantId } })
    await stage(['one'])
    await expect(confirm()).rejects.toBeInstanceOf(ForbiddenException)
    const otherTenantId = `u3b-claim-${randomUUID()}`
    await prisma.tenant.create({ data: { id: otherTenantId, name: otherTenantId, slug: otherTenantId } })
    await prisma.publisherClaim.create({ data: { tenantId: otherTenantId, externalSource: 'ZONAPROP', publisherId: '123', state: 'APPROVED' } })
    await expect(confirm()).rejects.toBeInstanceOf(ForbiddenException)
    await prisma.tenant.delete({ where: { id: otherTenantId } })
    await prisma.publisherClaim.create({ data: { tenantId, externalSource: 'ZONAPROP', publisherId: '123', state: 'PENDING' } })
    await expect(confirm()).rejects.toBeInstanceOf(ForbiddenException)
  })
  it('reports capacity and leaves rows retryable without partial records', async () => {
    await prisma.tenant.update({ where: { id: tenantId }, data: { maxActivePropertyEngagements: 0 } })
    await stage(['one', 'two'])
    expect(await confirm()).toMatchObject({ imported: 0, capacityExceeded: 1, notAttempted: 1 })
    expect(await prisma.propertyAsset.count({ where: { createdByUserId: userId } })).toBe(0)
    await prisma.tenant.update({ where: { id: tenantId }, data: { maxActivePropertyEngagements: null } })
    expect(await confirm()).toMatchObject({ imported: 2, capacityExceeded: 0 })
  })
  it('reports an already-imported listing as existing even when the plan is full', async () => {
    const [row] = await stage(['known'])
    const asset = await prisma.propertyAsset.create({ data: { title: 'Old', addressLine: '1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE', createdByUserId: userId } })
    const engagement = await prisma.propertyEngagement.create({ data: { tenantId, propertyAssetId: asset.id, operationType: 'SALE', createdByUserId: userId } })
    await prisma.externalPropertyReference.create({ data: { tenantId, externalSource: 'ZONAPROP', externalId: 'known', propertyEngagementId: engagement.id } })
    await prisma.tenant.update({ where: { id: tenantId }, data: { maxActivePropertyEngagements: 0 } })
    expect(await confirm()).toMatchObject({ existing: 1, capacityExceeded: 0 })
    expect(await prisma.propertyImportCandidate.findUniqueOrThrow({ where: { id: row!.id } })).toMatchObject({ state: 'EXISTING' })
  })
  it('links a concurrently-existing reference without creating another canonical record', async () => {
    const [row] = await stage(['existing'])
    const asset = await prisma.propertyAsset.create({ data: { title: 'Old', addressLine: '1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE', createdByUserId: userId } })
    const engagement = await prisma.propertyEngagement.create({ data: { tenantId, propertyAssetId: asset.id, operationType: 'SALE', createdByUserId: userId } })
    const ref = await prisma.externalPropertyReference.create({ data: { tenantId, externalSource: 'ZONAPROP', externalId: 'existing', propertyEngagementId: engagement.id } })
    expect(await confirm()).toMatchObject({ existing: 1, imported: 0 })
    expect(await prisma.propertyImportCandidate.findUniqueOrThrow({ where: { id: row!.id } })).toMatchObject({ state: 'EXISTING', resultingReferenceId: ref.id })
    expect(await prisma.propertyEngagement.count({ where: { tenantId } })).toBe(1)
  })
  it('isolates a row failure and ignores unselected and incomplete rows', async () => {
    const rows = await stage(['broken', 'good', 'incomplete', 'unselected'])
    await prisma.propertyImportCandidate.update({ where: { id: rows[2]!.id }, data: { state: 'INCOMPLETE', selected: false } })
    await prisma.propertyImportCandidate.update({ where: { id: rows[3]!.id }, data: { selected: false } })
    const original = repository.importCandidate.bind(repository); let fail = true
    repository.importCandidate = (async (...args: Parameters<typeof original>) => { if (fail) { fail = false; throw new Error('expected row failure') } return original(...args) }) as typeof repository.importCandidate
    try { expect(await confirm()).toMatchObject({ failed: 1, imported: 1, notAttempted: 0 }) } finally { repository.importCandidate = original }
    // Internal error details never reach the stored, user-visible reason.
    expect(await prisma.propertyImportCandidate.findUniqueOrThrow({ where: { id: rows[0]!.id } })).toMatchObject({ state: 'FAILED', errorReason: 'import_failed' })
  })
  it('never overwrites a candidate whose state changed concurrently', async () => {
    const [row] = await stage(['raced'])
    await prisma.propertyImportCandidate.update({ where: { id: row!.id }, data: { state: 'IMPORTED' } })
    await repository.markCandidate(tenantId, row!.id, 'READY', { state: 'FAILED', errorReason: 'import_failed' })
    expect(await prisma.propertyImportCandidate.findUniqueOrThrow({ where: { id: row!.id } })).toMatchObject({ state: 'IMPORTED' })
  })
  it('never imports a candidate belonging to another tenant batch', async () => {
    const otherTenantId = `u3b-other-${randomUUID()}`
    await prisma.tenant.create({ data: { id: otherTenantId, name: otherTenantId, slug: otherTenantId } })
    const otherBatch = await repository.createBatch({ tenantId: otherTenantId, initiatedByUserId: userId, externalSource: 'ZONAPROP', canonicalUrl: 'https://www.zonaprop.com.ar/inmobiliarias/agencia_123-inmuebles.html', publisherId: '123' })
    await new StageImportCandidatesUseCase(repository).execute({ ...context(), tenantId: otherTenantId }, otherBatch.id, [input('private')])
    await stage(['own']); await confirm()
    expect(await prisma.propertyImportCandidate.findFirstOrThrow({ where: { tenantId: otherTenantId, externalId: 'private' } })).toMatchObject({ state: 'READY' })
    await prisma.tenant.delete({ where: { id: otherTenantId } })
  })
  it('revalidates create permission on current tenant context', async () => {
    await stage(['one'])
    await expect(confirm([])).rejects.toBeInstanceOf(ForbiddenException)
  })
})
