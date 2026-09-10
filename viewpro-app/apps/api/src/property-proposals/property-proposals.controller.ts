import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import type { CurrentUser as CurrentUserContext } from '../auth/types/current-user'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
import { ApprovePropertyProposalDto } from './dto/approve-property-proposal.dto'
import { CreatePropertyProposalDto } from './dto/create-property-proposal.dto'
import { ListPropertyProposalReviewQuery } from './dto/list-property-proposal-review.query'
import { ListPropertyProposalsQuery } from './dto/list-property-proposals.query'
import { PropertyProposalIdParams } from './dto/property-proposal-id.params'
import { RejectPropertyProposalDto } from './dto/reject-property-proposal.dto'
import { SubmitPropertyProposalDto } from './dto/submit-property-proposal.dto'
import { UpdatePropertyProposalDto } from './dto/update-property-proposal.dto'
import { ApprovePropertyProposalUseCase } from './use-cases/approve-property-proposal.use-case'
import { CreatePropertyProposalUseCase } from './use-cases/create-property-proposal.use-case'
import { GetPropertyProposalReviewUseCase } from './use-cases/get-property-proposal-review.use-case'
import { GetPropertyProposalUseCase } from './use-cases/get-property-proposal.use-case'
import { ListPropertyProposalReviewUseCase } from './use-cases/list-property-proposal-review.use-case'
import { ListPropertyProposalsUseCase } from './use-cases/list-property-proposals.use-case'
import { RejectPropertyProposalUseCase } from './use-cases/reject-property-proposal.use-case'
import { SubmitPropertyProposalUseCase } from './use-cases/submit-property-proposal.use-case'
import { UpdatePropertyProposalUseCase } from './use-cases/update-property-proposal.use-case'

@Controller('property-proposals')
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class PropertyProposalsController {
  constructor(
    @Inject(CreatePropertyProposalUseCase)
    private readonly createPropertyProposalUseCase: CreatePropertyProposalUseCase,
    @Inject(ListPropertyProposalsUseCase)
    private readonly listPropertyProposalsUseCase: ListPropertyProposalsUseCase,
    @Inject(GetPropertyProposalUseCase)
    private readonly getPropertyProposalUseCase: GetPropertyProposalUseCase,
    @Inject(UpdatePropertyProposalUseCase)
    private readonly updatePropertyProposalUseCase: UpdatePropertyProposalUseCase,
    @Inject(SubmitPropertyProposalUseCase)
    private readonly submitPropertyProposalUseCase: SubmitPropertyProposalUseCase,
    @Inject(ListPropertyProposalReviewUseCase)
    private readonly listPropertyProposalReviewUseCase: ListPropertyProposalReviewUseCase,
    @Inject(GetPropertyProposalReviewUseCase)
    private readonly getPropertyProposalReviewUseCase: GetPropertyProposalReviewUseCase,
    @Inject(RejectPropertyProposalUseCase)
    private readonly rejectPropertyProposalUseCase: RejectPropertyProposalUseCase,
    @Inject(ApprovePropertyProposalUseCase)
    private readonly approvePropertyProposalUseCase: ApprovePropertyProposalUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_SELLER)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreatePropertyProposalDto,
  ) {
    const proposal = await this.createPropertyProposalUseCase.execute(
      tenant,
      currentUser,
      body as Parameters<CreatePropertyProposalUseCase['execute']>[2],
    )
    return this.getPropertyProposalUseCase.execute(tenant, currentUser, proposal.id)
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_SELLER)
  list(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListPropertyProposalsQuery,
  ) {
    return this.listPropertyProposalsUseCase.execute(tenant, currentUser, query)
  }

  @Get('review')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)
  listReview(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListPropertyProposalReviewQuery,
  ) {
    return this.listPropertyProposalReviewUseCase.execute(tenant, currentUser, query)
  }

  @Get('review/:proposalId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)
  getReview(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param() params: PropertyProposalIdParams,
  ) {
    return this.getPropertyProposalReviewUseCase.execute(tenant, currentUser, params.proposalId)
  }

  @Post('review/:proposalId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)
  async rejectReview(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param() params: PropertyProposalIdParams,
    @Body() body: RejectPropertyProposalDto,
  ) {
    const proposal = await this.rejectPropertyProposalUseCase.execute(tenant, currentUser, params.proposalId, body)
    return this.getPropertyProposalReviewUseCase.execute(tenant, currentUser, proposal.id)
  }

  @Post('review/:proposalId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_REVIEW)
  async approveReview(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param() params: PropertyProposalIdParams,
    @Body() body: ApprovePropertyProposalDto,
  ) {
    const proposal = await this.approvePropertyProposalUseCase.execute(tenant, currentUser, params.proposalId, body)
    return this.getPropertyProposalReviewUseCase.execute(tenant, currentUser, proposal.id)
  }

  @Get(':proposalId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_SELLER)
  get(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param() params: PropertyProposalIdParams,
  ) {
    return this.getPropertyProposalUseCase.execute(tenant, currentUser, params.proposalId)
  }

  @Patch(':proposalId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_SELLER)
  async update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param() params: PropertyProposalIdParams,
    @Body() body: UpdatePropertyProposalDto,
  ) {
    const proposal = await this.updatePropertyProposalUseCase.execute(
      tenant,
      currentUser,
      params.proposalId,
      body as Parameters<UpdatePropertyProposalUseCase['execute']>[3],
    )
    return this.getPropertyProposalUseCase.execute(tenant, currentUser, proposal.id)
  }

  @Post(':proposalId/submit')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PROPERTY_PROPOSALS_SELLER)
  async submit(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() currentUser: CurrentUserContext,
    @Param() params: PropertyProposalIdParams,
    @Body() body: SubmitPropertyProposalDto,
  ) {
    const { proposal } = await this.submitPropertyProposalUseCase.execute(
      tenant,
      currentUser,
      params.proposalId,
      body as Parameters<SubmitPropertyProposalUseCase['execute']>[3],
    )
    return this.getPropertyProposalUseCase.execute(tenant, currentUser, proposal.id)
  }

}
