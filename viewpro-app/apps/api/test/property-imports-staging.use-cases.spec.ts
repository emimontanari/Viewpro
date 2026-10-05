import { randomUUID } from 'node:crypto'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaClient, TenantRole, TenantStatus, UserStatus } from '@prisma/client'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CreateImportBatchUseCase, StageImportCandidatesUseCase, EditImportCandidateUseCase, SetImportCandidateSelectedUseCase, ListImportCandidatesUseCase } from '../src/property-imports/staging.use-cases'
import { PrismaPropertyImportStagingRepository } from '../src/property-imports/prisma-property-imports.repository'

const prisma = new PrismaClient()
const repository = new PrismaPropertyImportStagingRepository(prisma as never)
let tenantId: string; let userId: string; let batchId: string
const context = () => ({ tenantId, tenantSlug: tenantId, tenantStatus: TenantStatus.ACTIVE, membershipId: 'member', role: TenantRole.PRINCIPAL_MANAGER, permissions: [], userStatus: UserStatus.ACTIVE })
const currentUser = () => ({ id: userId, email: 'user@test.invalid' })
const input = (externalId: string, overrides: Record<string, unknown> = {}) => ({ externalId, sourceUrl: `https://www.zonaprop.com.ar/propiedades/clasificado/test-${externalId}.html`, title: 'Casa', addressLine: 'Calle 1', locationParts: ['Nueva Córdoba', 'Córdoba', 'Córdoba'], typeLabel: 'Casa', operationLabel: 'Venta', priceAmount: 100, priceCurrency: 'ARS', features: [{ code: 'CFT1', value: '3 ambientes' }], publisherId: '123', sourceSnapshot: { title: 'Casa' }, ...overrides })
const createBatch = (url: string) => new CreateImportBatchUseCase(repository).execute(context(), currentUser(), url)
const stage = (id: string, rows: ReturnType<typeof input>[], clock?: () => Date) => new StageImportCandidatesUseCase(repository).execute(context(), id, rows, clock)
const edit = (id: string, patch: { title?: string | null; addressLine?: string | null }) => new EditImportCandidateUseCase(repository).execute(context(), id, patch)
const select = (id: string, selected: boolean) => new SetImportCandidateSelectedUseCase(repository).execute(context(), id, selected)
afterAll(async () => prisma.$disconnect())
beforeEach(async () => {
  const id = randomUUID(); tenantId = `u3a-${id}`; userId = `u3a-user-${id}`
  await prisma.tenant.create({ data: { id: tenantId, name: tenantId, slug: tenantId } })
  await prisma.user.create({ data: { id: userId, email: `${id}@test.invalid`, passwordHash: 'test', firstName: 'Test' } })
  batchId = (await createBatch('https://www.zonaprop.com.ar/inmobiliarias/agencia_123-inmuebles.html')).id
})
afterEach(async () => { await prisma.tenant.deleteMany({ where: { id: tenantId } }); await prisma.propertyAsset.deleteMany({ where: { createdByUserId: userId } }); await prisma.user.deleteMany({ where: { id: userId } }) })

describe('property import staging use cases', () => {
  it('stages state outcomes and maps Córdoba/CABA city and province', async () => {
    const asset = await prisma.propertyAsset.create({ data: { title: 'Old', addressLine: '1', city: 'Córdoba', province: 'Córdoba', propertyType: 'HOUSE', createdByUserId: userId } })
    const engagement = await prisma.propertyEngagement.create({ data: { tenantId, propertyAssetId: asset.id, operationType: 'SALE', createdByUserId: userId } })
    await prisma.externalPropertyReference.create({ data: { tenantId, externalSource: 'ZONAPROP', externalId: 'existing', propertyEngagementId: engagement.id } })
    const rows = await stage(batchId, [input('ready'), input('incomplete', { addressLine: '' }), input('publisher', { publisherId: 'other' }), input('price', { priceCurrency: null }), input('existing'), input('caba', { locationParts: ['Palermo', 'Capital Federal'] })])
    expect(rows.map(row => row.state)).toEqual(['READY', 'INCOMPLETE', 'REJECTED', 'REJECTED', 'EXISTING', 'READY'])
    expect(rows[0]).toMatchObject({ city: 'Córdoba', province: 'Córdoba', selected: true })
    expect(rows[5]).toMatchObject({ city: 'Capital Federal', province: 'Capital Federal', selected: true })
    expect(rows.slice(1, 5).every(row => !row.selected)).toBe(true)
  })
  it('upserts idempotently, preserves selection and never changes terminal rows', async () => {
    const [first] = await stage(batchId, [input('same'), input('confirmed'), input('imported'), input('failed')]); await select(first!.id, false)
    for (const [id, state] of [['confirmed', 'CONFIRMED'], ['imported', 'IMPORTED'], ['failed', 'FAILED']] as const) await prisma.propertyImportCandidate.update({ where: { batchId_externalId: { batchId, externalId: id } }, data: { state, title: 'Frozen' } })
    const rows = await stage(batchId, [input('same', { title: 'Revised' }), input('confirmed'), input('imported'), input('failed')])
    expect(rows[0]).toMatchObject({ id: first?.id, title: 'Revised', selected: false })
    expect(rows.slice(1).map(row => [row.state, row.title])).toEqual([['CONFIRMED', 'Frozen'], ['IMPORTED', 'Frozen'], ['FAILED', 'Frozen']])
  })
  it('deselects a selected row when re-staging makes it non-ready', async () => {
    const [row] = await stage(batchId, [input('flip')]); expect(row).toMatchObject({ state: 'READY', selected: true })
    const [restaged] = await stage(batchId, [input('flip', { publisherId: 'other' })])
    expect(restaged).toMatchObject({ state: 'REJECTED', selected: false })
  })
  it('clears feature values that a re-staged listing no longer reports', async () => {
    await stage(batchId, [input('features', { features: [{ code: 'CFT1', value: '3 amb.' }, { code: 'CFT2', value: '2 dorm.' }] })])
    const [restaged] = await stage(batchId, [input('features', { features: [{ code: 'CFT1', value: '4 amb.' }, { code: 'CFT101', value: '57,5 m² cub.' }, { code: 'CFT5', value: '25 años' }, { code: '1000029', value: 'N' }] })])
    expect(restaged).toMatchObject({ rooms: 4, bedrooms: null, coveredAreaSqm: 58, ageYears: 25, orientation: 'N' })
  })
  it('does not overwrite a candidate whose state changed after it was read', async () => {
    const [row] = await stage(batchId, [input('race')])
    const stale = { ...row!, state: 'READY' as const }
    await prisma.propertyImportCandidate.update({ where: { id: row!.id }, data: { state: 'CONFIRMED' } })
    const racingRepository = Object.create(repository, { findCandidate: { value: async () => stale } })
    await expect(new EditImportCandidateUseCase(racingRepository).execute(context(), row!.id, { title: 'Late' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(new SetImportCandidateSelectedUseCase(racingRepository).execute(context(), row!.id, false)).rejects.toBeInstanceOf(BadRequestException)
    expect(await prisma.propertyImportCandidate.findUniqueOrThrow({ where: { id: row!.id } })).toMatchObject({ state: 'CONFIRMED', title: 'Casa' })
  })
  it('blocks staging after batch leaves ingestion states', async () => { await prisma.propertyImportBatch.update({ where: { id: batchId }, data: { state: 'READY' } }); await expect(stage(batchId, [input('late')])).rejects.toBeInstanceOf(BadRequestException) })
  it('allows selection only for READY; deselection is always allowed', async () => {
    const rows = await stage(batchId, [input('ready'), input('incomplete', { title: null }), input('rejected', { publisherId: 'bad' })])
    await expect(select(rows[1]!.id, true)).rejects.toBeInstanceOf(BadRequestException); await expect(select(rows[2]!.id, true)).rejects.toBeInstanceOf(BadRequestException)
    await expect(select(rows[2]!.id, false)).resolves.toMatchObject({ selected: false })
  })
  it('recomputes edit state, preserves selection unless incomplete, and rejects forbidden states', async () => {
    const rows = await stage(batchId, [input('editable'), input('selected-incomplete', { addressLine: '' }), input('rejected', { publisherId: 'bad' })]); await prisma.propertyImportCandidate.update({ where: { id: rows[1]!.id }, data: { selected: true } })
    expect(await edit(rows[1]!.id, { addressLine: 'Fixed' })).toMatchObject({ state: 'READY', selected: true })
    expect(await edit(rows[0]!.id, { title: '' })).toMatchObject({ state: 'INCOMPLETE', selected: false })
    await expect(edit(rows[2]!.id, { title: 'No' })).rejects.toBeInstanceOf(BadRequestException)
  })
  it('hides other tenants records', async () => {
    const [candidate] = await stage(batchId, [input('private')]); const other = { ...context(), tenantId: 'other' }
    await expect(new EditImportCandidateUseCase(repository).execute(other, candidate!.id, { title: 'X' })).rejects.toBeInstanceOf(NotFoundException)
    await expect(new ListImportCandidatesUseCase(repository).execute(other, batchId)).rejects.toBeInstanceOf(NotFoundException)
  })
  it('rejects invalid advertiser URLs', async () => { await expect(createBatch('http://evil.test/x')).rejects.toBeInstanceOf(BadRequestException) })
  it('sets snapshot expiry to 30 days from injected clock', async () => { const now = new Date('2026-01-01T00:00:00Z'); const [row] = await stage(batchId, [input('expiry')], () => now); expect(row?.snapshotExpiresAt).toEqual(new Date('2026-01-31T00:00:00Z')) })
})
