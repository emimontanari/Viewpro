import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { ArchivePropertyEngagementDto } from './dto/archive-property-engagement.dto'
import { AssignPropertyAgentDto } from './dto/assign-property-agent.dto'
import { CreatePropertyEngagementDto } from './dto/create-property-engagement.dto'
import { ListPropertyEngagementsQuery } from './dto/list-property-engagements.query'
import { UpdatePropertyEngagementDto } from './dto/update-property-engagement.dto'
import { AssignPropertyAgentUseCase } from './use-cases/assign-property-agent.use-case'
import { ArchivePropertyEngagementUseCase } from './use-cases/archive-property-engagement.use-case'
import { CreatePropertyEngagementUseCase } from './use-cases/create-property-engagement.use-case'
import { DeletePropertyImageUseCase } from './use-cases/delete-property-image.use-case'
import { GetPropertyEngagementUseCase } from './use-cases/get-property-engagement.use-case'
import { ListPropertyEngagementsUseCase } from './use-cases/list-property-engagements.use-case'
import { RestorePropertyEngagementUseCase } from './use-cases/restore-property-engagement.use-case'
import { SetPropertyImagePrimaryUseCase } from './use-cases/set-property-image-primary.use-case'
import { UpdatePropertyEngagementUseCase } from './use-cases/update-property-engagement.use-case'
import {
  PROPERTY_IMAGE_MAX_BYTES,
  UploadPropertyImageUseCase,
  type UploadedPropertyImageFile,
} from './use-cases/upload-property-image.use-case'

// Keep DTO/query classes as runtime values for Nest metadata when tests transpile with Vitest/esbuild.
const nestDtoRuntimeTypes = [
  ArchivePropertyEngagementDto,
  AssignPropertyAgentDto,
  CreatePropertyEngagementDto,
  ListPropertyEngagementsQuery,
  UpdatePropertyEngagementDto,
]
void nestDtoRuntimeTypes

@Controller('property-engagements')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class PropertyEngagementsController {
  constructor(
    @Inject(CreatePropertyEngagementUseCase)
    private readonly createPropertyEngagementUseCase: CreatePropertyEngagementUseCase,
    @Inject(ListPropertyEngagementsUseCase)
    private readonly listPropertyEngagementsUseCase: ListPropertyEngagementsUseCase,
    @Inject(GetPropertyEngagementUseCase)
    private readonly getPropertyEngagementUseCase: GetPropertyEngagementUseCase,
    @Inject(UpdatePropertyEngagementUseCase)
    private readonly updatePropertyEngagementUseCase: UpdatePropertyEngagementUseCase,
    @Inject(ArchivePropertyEngagementUseCase)
    private readonly archivePropertyEngagementUseCase: ArchivePropertyEngagementUseCase,
    @Inject(RestorePropertyEngagementUseCase)
    private readonly restorePropertyEngagementUseCase: RestorePropertyEngagementUseCase,
    @Inject(AssignPropertyAgentUseCase)
    private readonly assignPropertyAgentUseCase: AssignPropertyAgentUseCase,
    @Inject(UploadPropertyImageUseCase)
    private readonly uploadPropertyImageUseCase: UploadPropertyImageUseCase,
    @Inject(DeletePropertyImageUseCase)
    private readonly deletePropertyImageUseCase: DeletePropertyImageUseCase,
    @Inject(SetPropertyImagePrimaryUseCase)
    private readonly setPropertyImagePrimaryUseCase: SetPropertyImagePrimaryUseCase,
  ) {}

  @Post()
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreatePropertyEngagementDto,
  ) {
    return this.createPropertyEngagementUseCase.execute(tenant, currentUser, body)
  }

  @Get()
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListPropertyEngagementsQuery,
  ) {
    return this.listPropertyEngagementsUseCase.execute(tenant, currentUser, query)
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.getPropertyEngagementUseCase.execute(tenant, currentUser, id)
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() body: UpdatePropertyEngagementDto,
  ) {
    return this.updatePropertyEngagementUseCase.execute(tenant, currentUser, id, body)
  }

  @Post(':id/archive')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  archive(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() body: ArchivePropertyEngagementDto,
  ) {
    return this.archivePropertyEngagementUseCase.execute(tenant, currentUser, id, body)
  }

  @Post(':id/restore')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  restore(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.restorePropertyEngagementUseCase.execute(tenant, currentUser, id)
  }

  @Post(':id/images')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: PROPERTY_IMAGE_MAX_BYTES } }))
  uploadImage(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @UploadedFile() image: UploadedPropertyImageFile | undefined,
  ) {
    return this.uploadPropertyImageUseCase.execute(tenant, currentUser, id, image)
  }

  @Delete(':id/images/:imageId')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  deleteImage(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.deletePropertyImageUseCase.execute(tenant, currentUser, id, imageId)
  }

  @Patch(':id/images/:imageId/primary')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  setImagePrimary(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.setPropertyImagePrimaryUseCase.execute(tenant, currentUser, id, imageId)
  }

  @Post(':id/agents')
  @RequirePermissions(PERMISSIONS.ENGAGEMENTS_CREATE)
  assignAgent(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() body: AssignPropertyAgentDto,
  ) {
    return this.assignPropertyAgentUseCase.execute(tenant, currentUser, id, body)
  }
}
