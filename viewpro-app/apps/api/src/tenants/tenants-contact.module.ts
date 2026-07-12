import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { TenantsModule } from './tenants.module'
import { TenantsContactController } from './tenants-contact.controller'
import { GetTenantWhatsappPhoneUseCase } from './use-cases/get-tenant-whatsapp-phone.use-case'
import { UpdateTenantWhatsappPhoneUseCase } from './use-cases/update-tenant-whatsapp-phone.use-case'

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule, TenantsModule],
  controllers: [TenantsContactController],
  providers: [GetTenantWhatsappPhoneUseCase, UpdateTenantWhatsappPhoneUseCase],
})
export class TenantsContactModule {}
