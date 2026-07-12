import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AuthGuard } from '../auth/guards/auth.guard'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { CreateDocumentRequestDto } from './dto/create-document-request.dto'
import { ListDocumentRequestsQuery } from './dto/list-document-requests.query'
import { RejectDocumentRequestDto } from './dto/reject-document-request.dto'
import { ApproveDocumentRequestUseCase } from './use-cases/approve-document-request.use-case'
import { CreateDocumentRequestUseCase } from './use-cases/create-document-request.use-case'
import { CreateInternalDocumentReadUrlUseCase } from './use-cases/create-internal-document-read-url.use-case'
import { GetDocumentRequestUseCase } from './use-cases/get-document-request.use-case'
import { ListDocumentRequestsUseCase } from './use-cases/list-document-requests.use-case'
import { RejectDocumentRequestUseCase } from './use-cases/reject-document-request.use-case'

@Controller()
@ApiTags('Documents')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class DocumentsController {
  constructor(
    private readonly createDocumentRequestUseCase: CreateDocumentRequestUseCase,
    private readonly listDocumentRequestsUseCase: ListDocumentRequestsUseCase,
    private readonly getDocumentRequestUseCase: GetDocumentRequestUseCase,
    private readonly approveDocumentRequestUseCase: ApproveDocumentRequestUseCase,
    private readonly rejectDocumentRequestUseCase: RejectDocumentRequestUseCase,
    private readonly createInternalDocumentReadUrlUseCase: CreateInternalDocumentReadUrlUseCase,
  ) {}

  @Post('property-engagements/:propertyEngagementId/document-requests')
  @ApiOperation({ summary: 'Create a document request for an owner on a tenant property engagement' })
  @RequirePermissions(PERMISSIONS.DOCUMENTS_REQUEST)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('propertyEngagementId') propertyEngagementId: string,
    @Body() body: CreateDocumentRequestDto,
  ) {
    return this.createDocumentRequestUseCase.execute(tenant, currentUser, propertyEngagementId, body)
  }

  @Get('document-requests')
  @ApiOperation({ summary: 'List tenant document requests visible to the current internal user' })
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListDocumentRequestsQuery,
  ) {
    return this.listDocumentRequestsUseCase.execute(tenant, currentUser, query)
  }

  @Get('document-requests/:id')
  @ApiOperation({ summary: 'Get a tenant document request visible to the current internal user' })
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.getDocumentRequestUseCase.execute(tenant, currentUser, id)
  }

  @Post('document-requests/:id/approve')
  @ApiOperation({ summary: 'Approve a submitted document request as manager or requesting seller' })
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  approve(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.approveDocumentRequestUseCase.execute(tenant, currentUser, id)
  }

  @Post('document-requests/:id/reject')
  @ApiOperation({ summary: 'Reject a submitted document request with a required reason' })
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  reject(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
    @Body() body: RejectDocumentRequestDto,
  ) {
    return this.rejectDocumentRequestUseCase.execute(tenant, currentUser, id, body)
  }

  @Post('document-versions/:id/read-url')
  @ApiOperation({ summary: 'Create a signed read URL for an internally visible document version' })
  @RequirePermissions(PERMISSIONS.TENANT_VIEW)
  createReadUrl(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('id') id: string,
  ) {
    return this.createInternalDocumentReadUrlUseCase.execute(tenant, currentUser, id)
  }
}
