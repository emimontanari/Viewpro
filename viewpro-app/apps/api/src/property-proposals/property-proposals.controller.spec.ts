import { HttpStatus } from '@nestjs/common'
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { AuthModule } from '../auth/auth.module'
import { AuthGuard } from '../auth/guards/auth.guard'
import { DatabaseModule } from '../database/database.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { PermissionsModule } from '../permissions/permissions.module'
import { REQUIRED_PERMISSIONS_KEY } from '../permissions/require-permissions.decorator'
import { CanonicalPropertyMaterializer } from '../property-engagements/canonical-property-materializer'
import { PropertyEngagementsModule } from '../property-engagements/property-engagements.module'
import { PROPERTY_ENGAGEMENTS_REPOSITORY } from '../property-engagements/property-engagements.repository'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import { PropertyProposalsController } from './property-proposals.controller'
import { PropertyProposalsModule } from './property-proposals.module'
import { ApprovePropertyProposalUseCase } from './use-cases/approve-property-proposal.use-case'
import { CreatePropertyProposalUseCase } from './use-cases/create-property-proposal.use-case'
import { GetPropertyProposalReviewUseCase } from './use-cases/get-property-proposal-review.use-case'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalReviewUseCase } from './use-cases/list-property-proposal-review.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'
import { RejectPropertyProposalUseCase } from './use-cases/reject-property-proposal.use-case'
import { SubmitPropertyProposalUseCase } from './use-cases/submit-property-proposal.use-case'
import { UpdatePropertyProposalUseCase } from './use-cases/update-property-proposal.use-case'

const tenant = { tenantId: 'tenant-1' } as never
const user = { id: 'seller-1' } as never
const body = { title: 'Casa del lago', expectedVersion: 2 }
const proposal = { id: 'proposal-1' }
const detail = { id: 'proposal-1', history: [] }
const reviewRoundId = '4c2f7c4a-5320-4b7b-a9e3-d734869f7ad7'

const sellerHandlers = [
  ['create', '/', 'POST', HttpStatus.CREATED],
  ['list', '/', 'GET', HttpStatus.OK],
  ['get', ':proposalId', 'GET', HttpStatus.OK],
  ['update', ':proposalId', 'PATCH', HttpStatus.OK],
  ['submit', ':proposalId/submit', 'POST', HttpStatus.OK],
] as const

const reviewHandlers = [
  ['listReview', 'review', 'GET'],
  ['getReview', 'review/:proposalId', 'GET'],
  ['rejectReview', 'review/:proposalId/reject', 'POST'],
  ['approveReview', 'review/:proposalId/approve', 'POST'],
] as const

const methodMetadata = (method: 'GET' | 'POST' | 'PATCH') => method === 'GET' ? 0 : method === 'POST' ? 1 : 4

describe('PropertyProposalsController', () => {
  it('declares guarded reviewer static routes before dynamic seller routes with the review permission', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PropertyProposalsController)).toBe('property-proposals')
    expect(Reflect.getMetadata(GUARDS_METADATA, PropertyProposalsController)).toEqual([
      AuthGuard,
      TenantMembershipGuard,
      PermissionGuard,
    ])
    const handlers = Object.getOwnPropertyNames(PropertyProposalsController.prototype)
      .filter((name) => name !== 'constructor')
    expect(handlers).toEqual([...sellerHandlers.slice(0, 2).map(([name]) => name), ...reviewHandlers.map(([name]) => name), ...sellerHandlers.slice(2).map(([name]) => name)])

    for (const [handler, path, method, status] of sellerHandlers) {
      const target = PropertyProposalsController.prototype[handler]
      expect(Reflect.getMetadata(PATH_METADATA, target)).toBe(path)
      expect(Reflect.getMetadata(METHOD_METADATA, target)).toBe(methodMetadata(method))
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, target)).toBe(status)
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target)).toEqual([PERMISSIONS.PROPERTY_PROPOSALS_SELLER])
    }
    for (const [handler, path, method] of reviewHandlers) {
      const target = PropertyProposalsController.prototype[handler]
      expect(Reflect.getMetadata(PATH_METADATA, target)).toBe(path)
      expect(Reflect.getMetadata(METHOD_METADATA, target)).toBe(methodMetadata(method))
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, target)).toBe(HttpStatus.OK)
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target)).toEqual([PERMISSIONS.PROPERTY_PROPOSALS_REVIEW])
    }
  })

  it('uses trusted context, routes reviewer commands through safe reviewer rereads, and never returns command results', async () => {
    const create = { execute: vi.fn().mockResolvedValue(proposal) }
    const list = { execute: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) }
    const get = { execute: vi.fn().mockResolvedValue(detail) }
    const update = { execute: vi.fn().mockResolvedValue(proposal) }
    const submit = { execute: vi.fn().mockResolvedValue({ proposal, round: { id: 'round-1' } }) }
    const listReview = { execute: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) }
    const getReview = { execute: vi.fn().mockResolvedValue({ ...detail, reviewer: true }) }
    const rejectReview = { execute: vi.fn().mockResolvedValue({ id: proposal.id, raw: 'must-not-return' }) }
    const approveReview = { execute: vi.fn().mockResolvedValue({ id: proposal.id, raw: 'must-not-return' }) }
    const controller = new PropertyProposalsController(
      create as never, list as never, get as never, update as never, submit as never,
      listReview as never, getReview as never, rejectReview as never, approveReview as never,
    )

    await expect(controller.create(tenant, user, body)).resolves.toBe(detail)
    await expect(controller.list(tenant, user, { page: 2, pageSize: 10 })).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    await expect(controller.get(tenant, user, { proposalId: proposal.id })).resolves.toBe(detail)
    await expect(controller.update(tenant, user, { proposalId: proposal.id }, body)).resolves.toBe(detail)
    await expect(controller.submit(tenant, user, { proposalId: proposal.id }, { expectedVersion: 2 })).resolves.toBe(detail)
    await expect(controller.listReview(tenant, user, { history: 'PENDING', page: 1, pageSize: 20 })).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    await expect(controller.getReview(tenant, user, { proposalId: proposal.id })).resolves.toEqual({ ...detail, reviewer: true })
    await expect(controller.rejectReview(tenant, user, { proposalId: proposal.id }, { reviewRoundId, reason: 'Needs an address' })).resolves.toEqual({ ...detail, reviewer: true })
    await expect(controller.approveReview(tenant, user, { proposalId: proposal.id }, { reviewRoundId })).resolves.toEqual({ ...detail, reviewer: true })

    expect(create.execute).toHaveBeenCalledWith(tenant, user, body)
    expect(list.execute).toHaveBeenCalledWith(tenant, user, { page: 2, pageSize: 10 })
    expect(update.execute).toHaveBeenCalledWith(tenant, user, proposal.id, body)
    expect(submit.execute).toHaveBeenCalledWith(tenant, user, proposal.id, { expectedVersion: 2 })
    expect(get.execute).toHaveBeenNthCalledWith(1, tenant, user, proposal.id)
    expect(get.execute).toHaveBeenNthCalledWith(2, tenant, user, proposal.id)
    expect(get.execute).toHaveBeenNthCalledWith(3, tenant, user, proposal.id)
    expect(get.execute).toHaveBeenNthCalledWith(4, tenant, user, proposal.id)
    expect(listReview.execute).toHaveBeenCalledWith(tenant, user, { history: 'PENDING', page: 1, pageSize: 20 })
    expect(rejectReview.execute).toHaveBeenCalledWith(tenant, user, proposal.id, { reviewRoundId, reason: 'Needs an address' })
    expect(approveReview.execute).toHaveBeenCalledWith(tenant, user, proposal.id, { reviewRoundId })
    expect(getReview.execute).toHaveBeenNthCalledWith(1, tenant, user, proposal.id)
    expect(getReview.execute).toHaveBeenNthCalledWith(2, tenant, user, proposal.id)
    expect(getReview.execute).toHaveBeenNthCalledWith(3, tenant, user, proposal.id)
  })

  it('mounts review use cases once and imports the canonical materializer without rebinding the engagements repository', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PropertyProposalsModule)).toEqual([PropertyProposalsController])
    const proposalImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, PropertyProposalsModule) as unknown[]
    expect(proposalImports).toEqual([
      AuthModule,
      MembershipsModule,
      PermissionsModule,
      TenantContextModule,
      PropertyEngagementsModule,
    ])
    expect(proposalImports.filter((entry) => entry === PropertyEngagementsModule)).toHaveLength(1)

    const proposalProviders = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PropertyProposalsModule) as unknown[]
    for (const provider of [
      ListPropertyProposalReviewUseCase,
      GetPropertyProposalReviewUseCase,
      RejectPropertyProposalUseCase,
      ApprovePropertyProposalUseCase,
    ]) expect(proposalProviders.filter((entry) => entry === provider)).toHaveLength(1)
    expect(proposalProviders).toEqual(expect.arrayContaining([
      CreatePropertyProposalUseCase,
      GetPropertyProposalUseCase,
      ListPropertyProposalsUseCase,
      SubmitPropertyProposalUseCase,
      UpdatePropertyProposalUseCase,
    ]))
    expect(proposalProviders.filter((entry) => entry === CanonicalPropertyMaterializer)).toHaveLength(0)
    expect(proposalProviders.filter((entry) => typeof entry === 'object' && entry !== null
      && 'provide' in entry && entry.provide === PROPERTY_ENGAGEMENTS_REPOSITORY)).toHaveLength(0)

    const engagementExports = Reflect.getMetadata(MODULE_METADATA.EXPORTS, PropertyEngagementsModule) as unknown[]
    expect(engagementExports.filter((entry) => entry === CanonicalPropertyMaterializer)).toHaveLength(1)
    const appImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)
    expect(appImports.filter((entry: unknown) => entry === PropertyProposalsModule)).toHaveLength(1)
    expect(appImports.filter((entry: unknown) => entry === DatabaseModule)).toHaveLength(1)
  })
})
