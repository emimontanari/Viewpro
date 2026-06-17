import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { MembershipsModule } from '../memberships/memberships.module'
import { PermissionsModule } from '../permissions/permissions.module'
import { TenantContextModule } from '../tenant-context/tenant-context.module'
import { PrismaTenantsRepository } from './prisma-tenants.repository'
import { TenantsContactController } from './tenants-contact.controller'
import { TENANTS_REPOSITORY } from './tenants.repository'
import { GetTenantWhatsappPhoneUseCase } from './use-cases/get-tenant-whatsapp-phone.use-case'
import { UpdateTenantWhatsappPhoneUseCase } from './use-cases/update-tenant-whatsapp-phone.use-case'

const tenantUseCases = [GetTenantWhatsappPhoneUseCase, UpdateTenantWhatsappPhoneUseCase]

@Module({
  imports: [AuthModule, MembershipsModule, PermissionsModule, TenantContextModule],
  controllers: [TenantsContactController],
  providers: [
    { provide: TENANTS_REPOSITORY, useClass: PrismaTenantsRepository },
    ...tenantUseCases,
  ],
  exports: [TENANTS_REPOSITORY],
})
export class TenantsModule {}
