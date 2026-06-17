import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '../auth/guards/auth.guard'
import { PermissionGuard } from '../permissions/permission.guard'
import { PERMISSIONS } from '../permissions/permissions.constants'
import { RequirePermissions } from '../permissions/require-permissions.decorator'
import { CurrentTenant } from '../tenant-context/current-tenant.decorator'
import { ApiTenantContext } from '../tenant-context/tenant-context-api-docs.decorator'
import { TenantMembershipGuard } from '../tenant-context/tenant-membership.guard'
import type { TenantContext } from '../tenant-context/tenant-context.types'
// biome-ignore lint/style/useImportType: Nest validation needs runtime DTO metadata.
import { UpdateWhatsappPhoneDto } from './dto/update-whatsapp-phone.dto'
import { GetTenantWhatsappPhoneUseCase } from './use-cases/get-tenant-whatsapp-phone.use-case'
import { UpdateTenantWhatsappPhoneUseCase } from './use-cases/update-tenant-whatsapp-phone.use-case'

@Controller('tenants')
@ApiTenantContext()
@UseGuards(AuthGuard, TenantMembershipGuard, PermissionGuard)
export class TenantsContactController {
  constructor(
    private readonly getTenantWhatsappPhoneUseCase: GetTenantWhatsappPhoneUseCase,
    private readonly updateTenantWhatsappPhoneUseCase: UpdateTenantWhatsappPhoneUseCase,
  ) {}

  @Get('me/whatsapp-phone')
  @RequirePermissions(PERMISSIONS.TENANT_MANAGE_SETTINGS)
  async getWhatsappPhone(@CurrentTenant() tenant: TenantContext) {
    return this.getTenantWhatsappPhoneUseCase.execute({ tenantId: tenant.tenantId })
  }

  @Patch('me/whatsapp-phone')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions(PERMISSIONS.TENANT_MANAGE_SETTINGS)
  async updateWhatsappPhone(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: UpdateWhatsappPhoneDto,
  ): Promise<void> {
    await this.updateTenantWhatsappPhoneUseCase.execute({
      tenantId: tenant.tenantId,
      whatsappPhone: body.whatsappPhone,
    })
  }
}
