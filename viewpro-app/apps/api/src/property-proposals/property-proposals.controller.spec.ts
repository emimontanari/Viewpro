import { HttpStatus } from '@nestjs/common'
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants'
import { describe, expect, it, vi } from 'vitest'
import { AppModule } from '../app.module'
import { AuthModule } from '../auth/auth.module'
import { AuthGuard } from '../auth/guards/auth.guard'
import { DatabaseModule } from '../database/database.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionGuard } from '../permissions/permission.guard'
import { PermissionsModule } from '../permissions/permissions.module'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { REQUIRED_PERMISSIONS_KEY } from '../permissions/require-permissions.decorator'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import { PropertyProposalsController } from './property-proposals.controller'
import { PropertyProposalsModule } from './property-proposals.module'
import { CreatePropertyProposalUseCase } from './use-cases/create-property-proposal.use-case'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'
import { SubmitPropertyProposalUseCase } from './use-cases/submit-property-proposal.use-case'
import { UpdatePropertyProposalUseCase } from './use-cases/update-property-proposal.use-case'

const tenant = { tenantId: 'tenant-1' } as never
const user = { id: 'seller-1' } as never
const body = { title: 'Casa del lago', expectedVersion: 2 }
const proposal = { id: 'proposal-1' }
const detail = { id: 'proposal-1', history: [] }

const handlers = [
  ['create', '/', 'POST', HttpStatus.CREATED],
  ['list', '/', 'GET', HttpStatus.OK],
  ['get', ':proposalId', 'GET', HttpStatus.OK],
  ['update', ':proposalId', 'PATCH', HttpStatus.OK],
  ['submit', ':proposalId/submit', 'POST', HttpStatus.OK],
] as const

describe('PropertyProposalsController', () => {
  it('declares only the five seller routes with the exact guard and seller permission boundary', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PropertyProposalsController)).toBe('property-proposals')
    expect(Reflect.getMetadata(GUARDS_METADATA, PropertyProposalsController)).toEqual([
      AuthGuard,
      TenantMembershipGuard,
      PermissionGuard,
    ])
    expect(Object.getOwnPropertyNames(PropertyProposalsController.prototype)
      .filter((name) => name !== 'constructor')).toEqual(handlers.map(([name]) => name))

    for (const [handler, path, method, status] of handlers) {
      const target = PropertyProposalsController.prototype[handler]
      expect(Reflect.getMetadata(PATH_METADATA, target)).toBe(path)
      expect(Reflect.getMetadata(METHOD_METADATA, target)).toBe(method === 'GET' ? 0 : method === 'POST' ? 1 : 4)
      expect(Reflect.getMetadata(HTTP_CODE_METADATA, target)).toBe(status)
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target)).toEqual([PERMISSIONS.PROPERTY_PROPOSALS_SELLER])
    }
  })

  it('uses trusted tenant and user contexts, rereading every mutation through the safe detail use case', async () => {
    const create = { execute: vi.fn().mockResolvedValue(proposal) }
    const list = { execute: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) }
    const get = { execute: vi.fn().mockResolvedValue(detail) }
    const update = { execute: vi.fn().mockResolvedValue(proposal) }
    const submit = { execute: vi.fn().mockResolvedValue({ proposal, round: { id: 'round-1' } }) }
    const controller = new PropertyProposalsController(
      create as never,
      list as never,
      get as never,
      update as never,
      submit as never,
    )

    await expect(controller.create(tenant, user, body)).resolves.toBe(detail)
    await expect(controller.list(tenant, user, { page: 2, pageSize: 10 })).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 })
    await expect(controller.get(tenant, user, { proposalId: proposal.id })).resolves.toBe(detail)
    await expect(controller.update(tenant, user, { proposalId: proposal.id }, body)).resolves.toBe(detail)
    await expect(controller.submit(tenant, user, { proposalId: proposal.id }, { expectedVersion: 2 })).resolves.toBe(detail)

    expect(create.execute).toHaveBeenCalledWith(tenant, user, body)
    expect(list.execute).toHaveBeenCalledWith(tenant, user, { page: 2, pageSize: 10 })
    expect(update.execute).toHaveBeenCalledWith(tenant, user, proposal.id, body)
    expect(submit.execute).toHaveBeenCalledWith(tenant, user, proposal.id, { expectedVersion: 2 })
    expect(get.execute).toHaveBeenNthCalledWith(1, tenant, user, proposal.id)
    expect(get.execute).toHaveBeenNthCalledWith(2, tenant, user, proposal.id)
    expect(get.execute).toHaveBeenNthCalledWith(3, tenant, user, proposal.id)
    expect(get.execute).toHaveBeenNthCalledWith(4, tenant, user, proposal.id)
  })

  it('mounts the controller with its guard dependencies once and keeps database mounting in AppModule', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, PropertyProposalsModule)).toEqual([PropertyProposalsController])
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, PropertyProposalsModule)).toEqual([
      AuthModule,
      MembershipsModule,
      PermissionsModule,
      TenantContextModule,
    ])
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, PropertyProposalsModule)).toEqual(expect.arrayContaining([
      CreatePropertyProposalUseCase,
      GetPropertyProposalUseCase,
      ListPropertyProposalsUseCase,
      SubmitPropertyProposalUseCase,
      UpdatePropertyProposalUseCase,
    ]))
    const appImports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule)
    expect(appImports.filter((entry: unknown) => entry === PropertyProposalsModule)).toHaveLength(1)
    expect(appImports.filter((entry: unknown) => entry === DatabaseModule)).toHaveLength(1)
  })
})
